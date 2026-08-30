package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSZUMonthlyQuotaAccumulatesAndNeverResets(t *testing.T) {
	truncateTables(t)
	user := User{
		Username: "rollover-user",
		Password: "password",
		AffCode:  "rollover-aff",
		Status:   common.UserStatusEnabled,
		Quota:    7_500,
	}
	require.NoError(t, DB.Create(&user).Error)

	september := time.Date(2026, time.September, 1, 0, 0, 0, 0, szuQuotaLocation).Unix()
	october := time.Date(2026, time.October, 1, 0, 0, 0, 0, szuQuotaLocation).Unix()

	grantAt := func(timestamp int64) bool {
		t.Helper()
		granted := false
		require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
			var err error
			granted, err = grantSZUMonthlyQuotaForUserWithTx(tx, user.Id, timestamp)
			return err
		}))
		return granted
	}

	require.True(t, grantAt(september))
	require.False(t, grantAt(september+15*24*60*60))
	require.True(t, grantAt(october))

	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, 7_500+2*SZUMonthlyFreeQuota, user.Quota)

	var grants []SZUMonthlyQuotaGrant
	require.NoError(t, DB.Where("user_id = ?", user.Id).Order("grant_month").Find(&grants).Error)
	require.Len(t, grants, 2)
	assert.Equal(t, "2026-09", grants[0].GrantMonth)
	assert.Equal(t, "2026-10", grants[1].GrantMonth)
}

func TestSZUQuotaLedgerCombinesMonthlyAndRedemptionIncome(t *testing.T) {
	truncateTables(t)
	user := User{
		Username: "ledger-user",
		Password: "password",
		AffCode:  "ledger-aff",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(&user).Error)

	monthlyAt := time.Date(2026, time.August, 1, 0, 0, 0, 0, szuQuotaLocation).Unix()
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		_, err := grantSZUMonthlyQuotaForUserWithTx(tx, user.Id, monthlyAt)
		return err
	}))

	redemption := Redemption{
		UserId:       1,
		Key:          "0123456789abcdef0123456789abcdef",
		Status:       common.RedemptionCodeStatusUsed,
		Name:         "laboratory bonus",
		Quota:        25_000,
		CreatedTime:  monthlyAt + 10,
		RedeemedTime: monthlyAt + 20,
		UsedUserId:   user.Id,
	}
	require.NoError(t, DB.Create(&redemption).Error)
	require.NoError(t, creditTopUpQuota(DB, user.Id, redemption.Quota, nil))

	entries, total, err := GetSZUQuotaLedger(user.Id, 0, 20)
	require.NoError(t, err)
	require.Equal(t, 2, total)
	require.Len(t, entries, 2)
	assert.Equal(t, "redemption", entries[0].Source)
	assert.Equal(t, 25_000, entries[0].Amount)
	assert.Equal(t, "monthly", entries[1].Source)
	assert.Equal(t, SZUMonthlyFreeQuota, entries[1].Amount)
	assert.Equal(t, "2026-08", entries[1].GrantMonth)
	assert.Empty(t, entries[1].Description)

	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, SZUMonthlyFreeQuota+25_000, user.Quota)
}

func TestSZUStartupCancelsLegacyAutomaticSubscriptions(t *testing.T) {
	truncateTables(t)
	user := User{
		Username: "legacy-user",
		Password: "password",
		AffCode:  "legacy-aff",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(&user).Error)
	plan := SubscriptionPlan{
		Title:         "legacy monthly pool",
		DurationUnit:  SubscriptionDurationYear,
		DurationValue: 1,
		TotalAmount:   5_000_000,
	}
	require.NoError(t, DB.Create(&plan).Error)
	subscription := UserSubscription{
		UserId:        user.Id,
		PlanId:        plan.Id,
		Status:        "active",
		Source:        szuAutomaticSubscriptionSource,
		EndTime:       time.Now().AddDate(1, 0, 0).Unix(),
		NextResetTime: time.Now().AddDate(0, 1, 0).Unix(),
	}
	require.NoError(t, DB.Create(&subscription).Error)

	require.NoError(t, EnsureSZUMonthlyQuotaGrants())
	require.NoError(t, DB.First(&subscription, subscription.Id).Error)
	assert.Equal(t, "cancelled", subscription.Status)
	assert.Zero(t, subscription.NextResetTime)

	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, SZUMonthlyFreeQuota, user.Quota)
}

func TestSZUStartupNormalizesLegacyUserGroupsAndTokenRestrictions(t *testing.T) {
	truncateTables(t)
	user := User{
		Username: "legacy-routing-user",
		Password: "password",
		AffCode:  "legacy-routing-aff",
		Status:   common.UserStatusEnabled,
		Group:    "vip",
	}
	require.NoError(t, DB.Create(&user).Error)
	allowIps := "192.0.2.0/24"
	token := Token{
		UserId:             user.Id,
		Name:               "legacy-restricted-token",
		Key:                "legacy-restricted-token-key",
		Status:             common.TokenStatusEnabled,
		ExpiredTime:        1,
		RemainQuota:        99,
		ModelLimitsEnabled: true,
		ModelLimits:        "legacy-model",
		AllowIps:           &allowIps,
		Group:              "vip",
		CrossGroupRetry:    true,
		AutoGroups:         `["vip"]`,
	}
	require.NoError(t, DB.Create(&token).Error)

	require.NoError(t, EnsureSZUMonthlyQuotaGrants())
	require.NoError(t, DB.First(&user, user.Id).Error)
	require.NoError(t, DB.First(&token, token.Id).Error)

	assert.Equal(t, "default", user.Group)
	assert.EqualValues(t, -1, token.ExpiredTime)
	assert.Zero(t, token.RemainQuota)
	assert.True(t, token.UnlimitedQuota)
	assert.False(t, token.ModelLimitsEnabled)
	assert.Empty(t, token.ModelLimits)
	require.NotNil(t, token.AllowIps)
	assert.Empty(t, *token.AllowIps)
	assert.Equal(t, "default", token.Group)
	assert.False(t, token.CrossGroupRetry)
	assert.Empty(t, token.AutoGroups)
}

func TestSZUStartupMigrationIsSafeBeforeRedisInitialization(t *testing.T) {
	truncateTables(t)
	user := User{
		Username: "pre-redis-migration-user",
		Password: "password",
		AffCode:  "pre-redis-migration-aff",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, DB.Create(&Token{
		UserId: user.Id,
		Name:   "pre-redis-token",
		Key:    "pre-redis-token-key",
		Status: common.TokenStatusEnabled,
	}).Error)

	oldRedisEnabled, oldRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled = true
	common.RDB = nil
	t.Cleanup(func() {
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
	})

	require.NotPanics(t, func() {
		require.NoError(t, EnsureSZUMonthlyQuotaGrants())
	})
}

func TestManagedRoleMappingKeepsAuthorizationAndAccountTypeConsistent(t *testing.T) {
	tests := []struct {
		name        string
		managedRole string
		role        int
		accountType string
	}{
		{name: "administrator", managedRole: ManagedRoleAdmin, role: common.RoleAdminUser, accountType: AccountTypeTeacher},
		{name: "teacher", managedRole: ManagedRoleTeacher, role: common.RoleCommonUser, accountType: AccountTypeTeacher},
		{name: "student", managedRole: ManagedRoleStudent, role: common.RoleCommonUser, accountType: AccountTypeStudent},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			user := User{}
			require.NoError(t, ApplyManagedRole(&user, test.managedRole))
			assert.Equal(t, test.role, user.Role)
			assert.Equal(t, test.accountType, user.AccountType)
			assert.Equal(t, test.managedRole, ManagedRoleForUser(&user))
		})
	}
}

func TestManagedUserIdentityMirrorsEmailAndCompatibilityDisplayName(t *testing.T) {
	user := User{Username: " Teacher@Example.ORG ", DisplayName: "ignored", Email: "ignored@example.org"}
	require.NoError(t, NormalizeManagedUserIdentity(&user))
	assert.Equal(t, "teacher@example.org", user.Username)
	assert.Equal(t, "teacher@example.org", user.Email)
	assert.Equal(t, "teacher@example.org", user.DisplayName)

	user.Username = "student-number"
	require.NoError(t, NormalizeManagedUserIdentity(&user))
	assert.Equal(t, "student-number", user.Username)
	assert.Empty(t, user.Email)
	assert.Equal(t, "student-number", user.DisplayName)
}

func TestSZUStartupNormalizesLegacyManagedRoleColumns(t *testing.T) {
	truncateTables(t)
	admin := User{
		Username: "legacy-admin-role", Password: "password", AffCode: "legacy-admin-role-aff",
		Role: common.RoleAdminUser, AccountType: AccountTypeStudent, Status: common.UserStatusEnabled,
	}
	student := User{
		Username: "legacy-student-role", Password: "password", AffCode: "legacy-student-role-aff",
		Role: common.RoleCommonUser, AccountType: "unknown", Status: common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(&admin).Error)
	require.NoError(t, DB.Create(&student).Error)

	require.NoError(t, EnsureSZUMonthlyQuotaGrants())
	require.NoError(t, DB.First(&admin, admin.Id).Error)
	require.NoError(t, DB.First(&student, student.Id).Error)
	assert.Equal(t, AccountTypeTeacher, admin.AccountType)
	assert.Equal(t, ManagedRoleAdmin, ManagedRoleForUser(&admin))
	assert.Equal(t, AccountTypeStudent, student.AccountType)
	assert.Equal(t, ManagedRoleStudent, ManagedRoleForUser(&student))
}
