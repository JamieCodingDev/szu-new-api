package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSZUQuotaOnlyRedemptionWorksWithoutPaymentConfiguration(t *testing.T) {
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Redemption{}))

	paymentSetting := operation_setting.GetPaymentSetting()
	previousConfirmed := paymentSetting.ComplianceConfirmed
	previousVersion := paymentSetting.ComplianceTermsVersion
	paymentSetting.ComplianceConfirmed = false
	paymentSetting.ComplianceTermsVersion = ""
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = previousConfirmed
		paymentSetting.ComplianceTermsVersion = previousVersion
	})

	gin.SetMode(gin.TestMode)
	createRecorder := httptest.NewRecorder()
	createContext, _ := gin.CreateTestContext(createRecorder)
	createContext.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/redemption",
		strings.NewReader(`{"name":"monthly-overflow","quota":100000,"count":99}`),
	)
	createContext.Request.Header.Set("Content-Type", "application/json")
	createContext.Set("id", 1)
	createContext.Set("role", common.RoleRootUser)
	AddRedemption(createContext)
	assert.Contains(t, createRecorder.Body.String(), `"success":true`)

	var redemption model.Redemption
	require.NoError(t, db.First(&redemption).Error)
	assert.Equal(t, 100000, redemption.Quota)
	var redemptionCount int64
	require.NoError(t, db.Model(&model.Redemption{}).Count(&redemptionCount).Error)
	assert.EqualValues(t, 1, redemptionCount)

	user := model.User{
		Username: "redemption-user", Password: "password", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", Quota: 0,
	}
	require.NoError(t, db.Create(&user).Error)

	redeemRecorder := httptest.NewRecorder()
	redeemContext, _ := gin.CreateTestContext(redeemRecorder)
	redeemContext.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/user/topup",
		strings.NewReader(`{"key":"`+redemption.Key+`"}`),
	)
	redeemContext.Request.Header.Set("Content-Type", "application/json")
	redeemContext.Set("id", user.Id)
	TopUp(redeemContext)
	assert.Contains(t, redeemRecorder.Body.String(), `"success":true`)

	var updated model.User
	require.NoError(t, db.First(&updated, user.Id).Error)
	assert.Equal(t, 100000, updated.Quota)
}
