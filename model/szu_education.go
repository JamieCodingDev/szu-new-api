package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AccountTypeStudent = "student"
	AccountTypeTeacher = "teacher"
	ManagedRoleAdmin   = "admin"
	ManagedRoleTeacher = "teacher"
	ManagedRoleStudent = "student"

	// Every enabled account receives the same monthly free grant. The grant is
	// credited to the ordinary user wallet, so unused quota automatically rolls
	// over and redemption credits are available through the same balance.
	SZUMonthlyFreeQuota = 100_000

	// Kept as aliases for callers that display the account type. Account type no
	// longer changes quota or creates a subscription.
	SZUStudentMonthlyQuota = SZUMonthlyFreeQuota
	SZUTeacherMonthlyQuota = SZUMonthlyFreeQuota

	szuAutomaticSubscriptionSource = "szu_auto"
)

var szuQuotaLocation = time.FixedZone("Asia/Shanghai", 8*60*60)

// SZUMonthlyQuotaGrant is both an idempotency record and an income-ledger row.
// The composite unique index guarantees one grant per user per calendar month
// even when several application instances run the maintenance task.
type SZUMonthlyQuotaGrant struct {
	Id         int64  `json:"id"`
	UserId     int    `json:"user_id" gorm:"not null;uniqueIndex:idx_szu_monthly_grant"`
	GrantMonth string `json:"grant_month" gorm:"type:varchar(7);not null;uniqueIndex:idx_szu_monthly_grant"`
	Amount     int    `json:"amount" gorm:"not null"`
	GrantedAt  int64  `json:"granted_at" gorm:"bigint;not null;index"`
}

type SZUQuotaLedgerEntry struct {
	Id          string `json:"id"`
	Source      string `json:"source"`
	Amount      int    `json:"amount"`
	CreatedAt   int64  `json:"created_at"`
	Description string `json:"description"`
	GrantMonth  string `json:"grant_month,omitempty"`
}

func NormalizeAccountType(accountType string) string {
	if strings.EqualFold(strings.TrimSpace(accountType), AccountTypeTeacher) {
		return AccountTypeTeacher
	}
	return AccountTypeStudent
}

func ParseManagedRole(value string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case ManagedRoleAdmin:
		return ManagedRoleAdmin, true
	case ManagedRoleTeacher:
		return ManagedRoleTeacher, true
	case ManagedRoleStudent:
		return ManagedRoleStudent, true
	default:
		return "", false
	}
}

// ManagedRoleForUser exposes the single business role used by the SZU user
// management UI while preserving New API's numeric authorization role.
func ManagedRoleForUser(user *User) string {
	if user != nil && user.Role >= common.RoleAdminUser {
		return ManagedRoleAdmin
	}
	if user != nil && NormalizeAccountType(user.AccountType) == AccountTypeTeacher {
		return ManagedRoleTeacher
	}
	return ManagedRoleStudent
}

// ApplyManagedRole keeps the legacy role/account_type columns synchronized.
// Root is handled by the update controller so the built-in account can never
// be demoted through the three-option management form.
func ApplyManagedRole(user *User, value string) error {
	if user == nil {
		return errors.New("user is required")
	}
	managedRole, ok := ParseManagedRole(value)
	if !ok {
		return errors.New("invalid managed role")
	}
	user.ManagedRole = managedRole
	switch managedRole {
	case ManagedRoleAdmin:
		user.Role = common.RoleAdminUser
		user.AccountType = AccountTypeTeacher
	case ManagedRoleTeacher:
		user.Role = common.RoleCommonUser
		user.AccountType = AccountTypeTeacher
	case ManagedRoleStudent:
		user.Role = common.RoleCommonUser
		user.AccountType = AccountTypeStudent
	}
	return nil
}

// NormalizeManagedUserIdentity stores one administrator-entered identifier.
// When it is an email address, the normalized value is mirrored into email;
// otherwise the compatibility email column is cleared. display_name remains
// synchronized for older consumers but is not separately editable.
func NormalizeManagedUserIdentity(user *User) error {
	if user == nil {
		return errors.New("user is required")
	}
	identifier := strings.TrimSpace(user.Username)
	if identifier == "" || len(identifier) > UserNameMaxLength {
		return errors.New("invalid username or email")
	}
	if strings.Contains(identifier, "@") {
		identifier = NormalizeEmail(identifier)
		parts := strings.Split(identifier, "@")
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			return errors.New("invalid email")
		}
		user.Email = identifier
	} else {
		user.Email = ""
	}
	user.Username = identifier
	user.DisplayName = identifier
	return nil
}

func szuGrantMonth(timestamp int64) string {
	return time.Unix(timestamp, 0).In(szuQuotaLocation).Format("2006-01")
}

// grantSZUMonthlyQuotaForUserWithTx credits exactly one monthly grant. It must
// run inside a transaction so the ledger row and wallet increment commit or
// roll back together.
func grantSZUMonthlyQuotaForUserWithTx(tx *gorm.DB, userId int, timestamp int64) (bool, error) {
	if tx == nil || userId <= 0 {
		return false, errors.New("invalid monthly quota grant arguments")
	}
	if timestamp <= 0 {
		timestamp = getDBTimestampWithTx(tx)
	}

	grant := SZUMonthlyQuotaGrant{
		UserId:     userId,
		GrantMonth: szuGrantMonth(timestamp),
		Amount:     SZUMonthlyFreeQuota,
		GrantedAt:  timestamp,
	}
	result := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "grant_month"}},
		DoNothing: true,
	}).Create(&grant)
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 0 {
		return false, nil
	}
	if err := creditTopUpQuota(tx, userId, SZUMonthlyFreeQuota, nil); err != nil {
		return false, err
	}
	return true, nil
}

// EnsureSZUMonthlyQuotaForUserWithTx grants the current month's free quota.
// It is safe to call during user creation, account edits, and startup.
func EnsureSZUMonthlyQuotaForUserWithTx(tx *gorm.DB, user *User) error {
	if tx == nil || user == nil || user.Id <= 0 {
		return errors.New("invalid monthly quota user")
	}
	_, err := grantSZUMonthlyQuotaForUserWithTx(tx, user.Id, getDBTimestampWithTx(tx))
	return err
}

func EnsureSZUMonthlyQuotaForUser(userId int) error {
	if userId <= 0 {
		return errors.New("invalid user id")
	}
	granted := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		granted, err = grantSZUMonthlyQuotaForUserWithTx(tx, userId, getDBTimestampWithTx(tx))
		return err
	})
	if err == nil && granted {
		syncCreditUserQuotaCache(userId, SZUMonthlyFreeQuota, "monthly free quota")
	}
	return err
}

// GrantCurrentSZUMonthlyQuota is called by the existing minute-level
// maintenance task. The unique index makes repeated calls inexpensive and
// safe; it only credits users who do not yet have this month's ledger row.
func GrantCurrentSZUMonthlyQuota() (int, error) {
	now := GetDBTimestamp()
	var users []User
	if err := DB.Select("id").Where("status = ?", common.UserStatusEnabled).Find(&users).Error; err != nil {
		return 0, err
	}

	grantedUserIDs := make([]int, 0)
	for _, user := range users {
		granted := false
		err := DB.Transaction(func(tx *gorm.DB) error {
			var err error
			granted, err = grantSZUMonthlyQuotaForUserWithTx(tx, user.Id, now)
			return err
		})
		if err != nil {
			return len(grantedUserIDs), err
		}
		if granted {
			grantedUserIDs = append(grantedUserIDs, user.Id)
		}
	}
	for _, userId := range grantedUserIDs {
		syncCreditUserQuotaCache(userId, SZUMonthlyFreeQuota, "monthly free quota")
	}
	return len(grantedUserIDs), nil
}

// EnsureSZUMonthlyQuotaGrants migrates the previous subscription-based
// implementation without deleting any balance. Legacy automatic
// subscriptions are cancelled so they can no longer reset or spend a second
// quota pool, then the current wallet grant is applied exactly once.
func EnsureSZUMonthlyQuotaGrants() error {
	now := GetDBTimestamp()
	var tokenKeys []string
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&UserSubscription{}).
			Where("status = ? AND source = ?", "active", szuAutomaticSubscriptionSource).
			Updates(map[string]interface{}{
				"status":          "cancelled",
				"end_time":        now,
				"next_reset_time": 0,
				"updated_at":      now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where(commonGroupCol+" <> ?", "default").Update("group", "default").Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).
			Where("role >= ?", common.RoleAdminUser).
			Update("account_type", AccountTypeTeacher).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).
			Where("role < ? AND (account_type IS NULL OR account_type NOT IN ?)", common.RoleAdminUser, []string{AccountTypeStudent, AccountTypeTeacher}).
			Update("account_type", AccountTypeStudent).Error; err != nil {
			return err
		}
		if tx.Migrator().HasTable(&Token{}) {
			if err := tx.Model(&Token{}).Pluck("key", &tokenKeys).Error; err != nil {
				return err
			}
			emptyAllowIps := ""
			if err := tx.Model(&Token{}).Where("1 = 1").Updates(map[string]interface{}{
				"expired_time":         -1,
				"remain_quota":         0,
				"unlimited_quota":      true,
				"model_limits_enabled": false,
				"model_limits":         "",
				"allow_ips":            emptyAllowIps,
				"group":                "default",
				"cross_group_retry":    false,
				"auto_groups":          "",
			}).Error; err != nil {
				return err
			}
		}

		var users []User
		if err := tx.Select("id").Where("status = ?", common.UserStatusEnabled).Find(&users).Error; err != nil {
			return err
		}
		for _, user := range users {
			if _, err := grantSZUMonthlyQuotaForUserWithTx(tx, user.Id, now); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	for _, key := range tokenKeys {
		if cacheErr := invalidateTokenCacheForMutation(key); cacheErr != nil {
			common.SysError("failed to invalidate normalized token cache: " + cacheErr.Error())
		}
	}
	return nil
}

// GetSZUQuotaLedger returns the only two permitted quota-income sources:
// monthly free grants and successfully redeemed codes.
func GetSZUQuotaLedger(userId int, startIdx int, num int) ([]SZUQuotaLedgerEntry, int, error) {
	if userId <= 0 {
		return nil, 0, errors.New("invalid user id")
	}
	if startIdx < 0 {
		startIdx = 0
	}
	if num <= 0 {
		num = 20
	}

	var grants []SZUMonthlyQuotaGrant
	if err := DB.Where("user_id = ?", userId).Find(&grants).Error; err != nil {
		return nil, 0, err
	}
	var redemptions []Redemption
	if err := DB.Where("used_user_id = ? AND status = ?", userId, common.RedemptionCodeStatusUsed).Find(&redemptions).Error; err != nil {
		return nil, 0, err
	}

	entries := make([]SZUQuotaLedgerEntry, 0, len(grants)+len(redemptions))
	for _, grant := range grants {
		entries = append(entries, SZUQuotaLedgerEntry{
			Id:         fmt.Sprintf("monthly-%d", grant.Id),
			Source:     "monthly",
			Amount:     grant.Amount,
			CreatedAt:  grant.GrantedAt,
			GrantMonth: grant.GrantMonth,
		})
	}
	for _, redemption := range redemptions {
		entries = append(entries, SZUQuotaLedgerEntry{
			Id:          fmt.Sprintf("redemption-%d", redemption.Id),
			Source:      "redemption",
			Amount:      redemption.Quota,
			CreatedAt:   redemption.RedeemedTime,
			Description: redemption.Name,
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].CreatedAt == entries[j].CreatedAt {
			return entries[i].Id > entries[j].Id
		}
		return entries[i].CreatedAt > entries[j].CreatedAt
	})
	total := len(entries)
	if startIdx >= total {
		return []SZUQuotaLedgerEntry{}, total, nil
	}
	end := startIdx + num
	if end > total {
		end = total
	}
	return entries[startIdx:end], total, nil
}

// Compatibility wrappers for older call sites. Their behavior is now a
// wallet grant, not a subscription assignment.
func SyncSZUEducationSubscriptionForUserWithTx(tx *gorm.DB, user *User) error {
	return EnsureSZUMonthlyQuotaForUserWithTx(tx, user)
}

func SyncSZUEducationSubscriptionForUser(userId int) error {
	return EnsureSZUMonthlyQuotaForUser(userId)
}

func EnsureSZUEducationPlansAndSubscriptions() error {
	return EnsureSZUMonthlyQuotaGrants()
}
