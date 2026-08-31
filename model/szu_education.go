package model

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
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

	// Monthly grants are credited to the ordinary user wallet. Unused quota
	// automatically rolls over and redemption credits use the same balance.
	SZUStudentMonthlyQuota = 100_000
	SZUTeacherMonthlyQuota = 200_000
	SZUAdminMonthlyQuota   = 1_000_000

	SZUStudentMonthlyQuotaOptionKey = "SZUStudentMonthlyQuota"
	SZUTeacherMonthlyQuotaOptionKey = "SZUTeacherMonthlyQuota"
	SZUAdminMonthlyQuotaOptionKey   = "SZUAdminMonthlyQuota"

	// Kept for compatibility with callers that use the old student-default
	// constant. New code should use SZUMonthlyQuotaForUser.
	SZUMonthlyFreeQuota = SZUStudentMonthlyQuota

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

// SZUMonthlyQuotaDefaults is the global role-based monthly quota policy. The
// values are stored in the options table so administrators can change the
// policy without rebuilding or restarting the service.
type SZUMonthlyQuotaDefaults struct {
	Student int `json:"student"`
	Teacher int `json:"teacher"`
	Admin   int `json:"admin"`
}

func defaultSZUMonthlyQuotaDefaults() SZUMonthlyQuotaDefaults {
	return SZUMonthlyQuotaDefaults{
		Student: SZUStudentMonthlyQuota,
		Teacher: SZUTeacherMonthlyQuota,
		Admin:   SZUAdminMonthlyQuota,
	}
}

func configuredSZUMonthlyQuota(optionKey string, fallback int) int {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[optionKey]
	common.OptionMapRWMutex.RUnlock()

	quota, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || quota <= 0 || quota > common.MaxWalletQuota {
		return fallback
	}
	return quota
}

// loadSZUMonthlyQuotaDefaultsFromDatabase is used during database migration,
// before the full option map is initialized. This prevents a restart from
// temporarily applying the built-in fallback when an administrator has saved
// lower role quotas in the database.
func loadSZUMonthlyQuotaDefaultsFromDatabase() error {
	keys := []string{
		SZUStudentMonthlyQuotaOptionKey,
		SZUTeacherMonthlyQuotaOptionKey,
		SZUAdminMonthlyQuotaOptionKey,
	}
	var options []Option
	if err := querySZUMonthlyQuotaOptions(DB, &options, keys).Error; err != nil {
		return err
	}
	common.OptionMapRWMutex.Lock()
	defer common.OptionMapRWMutex.Unlock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	for _, option := range options {
		common.OptionMap[option.Key] = option.Value
	}
	return nil
}

func querySZUMonthlyQuotaOptions(db *gorm.DB, options *[]Option, keys []string) *gorm.DB {
	// A map condition makes GORM quote the reserved `key` column using the
	// active database dialect (MySQL/PostgreSQL/SQLite).
	return db.Where(map[string]interface{}{"key": keys}).Find(options)
}

// GetSZUMonthlyQuotaDefaults returns the current database-backed role policy,
// falling back to the built-in defaults if an option is missing or invalid.
func GetSZUMonthlyQuotaDefaults() SZUMonthlyQuotaDefaults {
	fallback := defaultSZUMonthlyQuotaDefaults()
	return SZUMonthlyQuotaDefaults{
		Student: configuredSZUMonthlyQuota(SZUStudentMonthlyQuotaOptionKey, fallback.Student),
		Teacher: configuredSZUMonthlyQuota(SZUTeacherMonthlyQuotaOptionKey, fallback.Teacher),
		Admin:   configuredSZUMonthlyQuota(SZUAdminMonthlyQuotaOptionKey, fallback.Admin),
	}
}

func ValidateSZUMonthlyQuotaDefaults(defaults SZUMonthlyQuotaDefaults) error {
	for role, quota := range map[string]int{
		ManagedRoleStudent: defaults.Student,
		ManagedRoleTeacher: defaults.Teacher,
		ManagedRoleAdmin:   defaults.Admin,
	} {
		if quota <= 0 || quota > common.MaxWalletQuota {
			return fmt.Errorf("%s monthly quota must be between 1 and %d", role, common.MaxWalletQuota)
		}
	}
	return nil
}

// UpdateSZUMonthlyQuotaDefaults atomically persists all three role values and
// updates the in-memory option cache after the database transaction commits.
func UpdateSZUMonthlyQuotaDefaults(defaults SZUMonthlyQuotaDefaults) error {
	if err := ValidateSZUMonthlyQuotaDefaults(defaults); err != nil {
		return err
	}
	return UpdateOptionsBulk(map[string]string{
		SZUStudentMonthlyQuotaOptionKey: strconv.Itoa(defaults.Student),
		SZUTeacherMonthlyQuotaOptionKey: strconv.Itoa(defaults.Teacher),
		SZUAdminMonthlyQuotaOptionKey:   strconv.Itoa(defaults.Admin),
	})
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

// SZUMonthlyQuotaForUser returns the role-specific monthly free grant.
func SZUMonthlyQuotaForUser(user *User) int {
	defaults := GetSZUMonthlyQuotaDefaults()
	switch ManagedRoleForUser(user) {
	case ManagedRoleAdmin:
		return defaults.Admin
	case ManagedRoleTeacher:
		return defaults.Teacher
	default:
		return defaults.Student
	}
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

// grantSZUMonthlyQuotaForUserWithTx credits one role-specific monthly grant. If
// an older grant for the same month is lower than the user's current role, only
// the difference is added. Downgrades never remove quota that was already
// granted. It must run inside a transaction so the ledger row and wallet update
// commit or roll back together.
func grantSZUMonthlyQuotaForUserWithTx(tx *gorm.DB, userId int, timestamp int64) (int, error) {
	if tx == nil || userId <= 0 {
		return 0, errors.New("invalid monthly quota grant arguments")
	}
	if timestamp <= 0 {
		timestamp = getDBTimestampWithTx(tx)
	}
	var user User
	if err := tx.Select("id", "role", "account_type").First(&user, userId).Error; err != nil {
		return 0, err
	}
	monthlyQuota := SZUMonthlyQuotaForUser(&user)

	grant := SZUMonthlyQuotaGrant{
		UserId:     userId,
		GrantMonth: szuGrantMonth(timestamp),
		Amount:     monthlyQuota,
		GrantedAt:  timestamp,
	}
	result := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "grant_month"}},
		DoNothing: true,
	}).Create(&grant)
	if result.Error != nil {
		return 0, result.Error
	}
	creditedQuota := monthlyQuota
	if result.RowsAffected == 0 {
		var existingGrant SZUMonthlyQuotaGrant
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("user_id = ? AND grant_month = ?", userId, grant.GrantMonth).
			First(&existingGrant).Error; err != nil {
			return 0, err
		}
		if existingGrant.Amount >= monthlyQuota {
			return 0, nil
		}
		creditedQuota = monthlyQuota - existingGrant.Amount
		if err := tx.Model(&existingGrant).Update("amount", monthlyQuota).Error; err != nil {
			return 0, err
		}
	}
	if err := creditTopUpQuota(tx, userId, creditedQuota, nil); err != nil {
		return 0, err
	}
	return creditedQuota, nil
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
	creditedQuota := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		creditedQuota, err = grantSZUMonthlyQuotaForUserWithTx(tx, userId, getDBTimestampWithTx(tx))
		return err
	})
	if err == nil && creditedQuota > 0 {
		syncCreditUserQuotaCache(userId, creditedQuota, "monthly free quota")
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

	type monthlyQuotaCredit struct {
		userId int
		amount int
	}
	credits := make([]monthlyQuotaCredit, 0)
	for _, user := range users {
		creditedQuota := 0
		err := DB.Transaction(func(tx *gorm.DB) error {
			var err error
			creditedQuota, err = grantSZUMonthlyQuotaForUserWithTx(tx, user.Id, now)
			return err
		})
		if err != nil {
			return len(credits), err
		}
		if creditedQuota > 0 {
			credits = append(credits, monthlyQuotaCredit{userId: user.Id, amount: creditedQuota})
		}
	}
	for _, credit := range credits {
		syncCreditUserQuotaCache(credit.userId, credit.amount, "monthly free quota")
	}
	return len(credits), nil
}

// InvalidateSZUUserQuotaCachesAfterRedisInit removes user wallet snapshots
// that may predate startup monthly grants. Database migration runs before the
// Redis client is initialized, so the grant ledger and wallet can commit while
// an old Redis hash still contains the previous balance. The next read safely
// hydrates each invalidated user from the database-authoritative wallet.
func InvalidateSZUUserQuotaCachesAfterRedisInit() error {
	if !common.SZUQuotaOnlyMode || !common.RedisEnabled || common.RDB == nil {
		return nil
	}
	var userIds []int
	if err := DB.Model(&User{}).Pluck("id", &userIds).Error; err != nil {
		return err
	}
	for _, userId := range userIds {
		if err := invalidateUserCache(userId); err != nil {
			return fmt.Errorf("invalidate user %d quota cache: %w", userId, err)
		}
	}
	return nil
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
// wallet grant, not a subscription assignment. The transactional variant
// returns the amount credited so callers can update Redis only after commit.
func SyncSZUEducationSubscriptionForUserWithTx(tx *gorm.DB, user *User) (int, error) {
	if tx == nil || user == nil || user.Id <= 0 {
		return 0, errors.New("invalid monthly quota user")
	}
	return grantSZUMonthlyQuotaForUserWithTx(tx, user.Id, getDBTimestampWithTx(tx))
}

func SyncSZUEducationSubscriptionForUser(userId int) error {
	return EnsureSZUMonthlyQuotaForUser(userId)
}

// SyncSZUMonthlyQuotaCreditCache applies a committed monthly credit to an
// existing Redis user hash. Cache misses remain database-authoritative.
func SyncSZUMonthlyQuotaCreditCache(userId int, quota int) {
	syncCreditUserQuotaCache(userId, quota, "monthly free quota")
}

func EnsureSZUEducationPlansAndSubscriptions() error {
	return EnsureSZUMonthlyQuotaGrants()
}
