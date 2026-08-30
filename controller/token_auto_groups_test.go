package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupUnrestrictedTokenControllerTest(t *testing.T) *model.User {
	t.Helper()
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	user := &model.User{
		Id:       101,
		Username: "unrestricted-token-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(user).Error)
	return user
}

func assertUnrestrictedToken(t *testing.T, token *model.Token) {
	t.Helper()
	assert.EqualValues(t, -1, token.ExpiredTime)
	assert.Zero(t, token.RemainQuota)
	assert.True(t, token.UnlimitedQuota)
	assert.False(t, token.ModelLimitsEnabled)
	assert.Empty(t, token.ModelLimits)
	if token.AllowIps != nil {
		assert.Empty(t, *token.AllowIps)
	}
	assert.Equal(t, "default", token.Group)
	assert.False(t, token.CrossGroupRetry)
	assert.Empty(t, token.AutoGroups)
}

func TestAddTokenIgnoresEveryPerKeyRestriction(t *testing.T) {
	user := setupUnrestrictedTokenControllerTest(t)
	request := map[string]any{
		"name":                 "credential-only",
		"expired_time":         1,
		"remain_quota":         999_999,
		"unlimited_quota":      false,
		"model_limits_enabled": true,
		"model_limits":         "forbidden-model",
		"allow_ips":            "192.0.2.1",
		"group":                "vip",
		"cross_group_retry":    true,
		"auto_groups":          []string{"vip"},
	}
	ctx, recorder := newAuthenticatedContext(
		t,
		http.MethodPost,
		"/api/token/",
		request,
		user.Id,
	)
	AddToken(ctx)
	require.True(t, decodeAPIResponse(t, recorder).Success)

	var token model.Token
	require.NoError(t, model.DB.Where("name = ?", "credential-only").First(&token).Error)
	assertUnrestrictedToken(t, &token)
}

func TestUpdateTokenNormalizesLegacyRestrictions(t *testing.T) {
	user := setupUnrestrictedTokenControllerTest(t)
	allowIps := "198.51.100.0/24"
	token := &model.Token{
		UserId:             user.Id,
		Name:               "legacy-restricted",
		Key:                "legacy-restricted-key",
		Status:             common.TokenStatusExpired,
		ExpiredTime:        1,
		RemainQuota:        123,
		UnlimitedQuota:     false,
		ModelLimitsEnabled: true,
		ModelLimits:        "legacy-model",
		AllowIps:           &allowIps,
		Group:              "vip",
		CrossGroupRetry:    true,
		AutoGroups:         `["vip"]`,
	}
	require.NoError(t, model.DB.Create(token).Error)

	ctx, recorder := newAuthenticatedContext(
		t,
		http.MethodPut,
		"/api/token/?status_only=true",
		map[string]any{"id": token.Id, "status": common.TokenStatusEnabled},
		user.Id,
	)
	ctx.Request.URL.RawQuery = "status_only=true"
	UpdateToken(ctx)
	require.True(t, decodeAPIResponse(t, recorder).Success)

	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, common.TokenStatusEnabled, token.Status)
	assertUnrestrictedToken(t, token)
}
