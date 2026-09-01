package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetSZUMonthlyQuotaDefaults returns the global monthly grant policy used for
// students, graduate students, teachers, and administrators.
func GetSZUMonthlyQuotaDefaults(c *gin.Context) {
	common.ApiSuccess(c, model.GetSZUMonthlyQuotaDefaults())
}

// UpdateSZUMonthlyQuotaDefaults changes the global role policy. Existing
// grants are never clawed back; the minute-level grant task automatically
// tops up the difference when a role's current-month value increases.
func UpdateSZUMonthlyQuotaDefaults(c *gin.Context) {
	var defaults model.SZUMonthlyQuotaDefaults
	if err := common.DecodeJson(c.Request.Body, &defaults); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateSZUMonthlyQuotaDefaults(defaults); err != nil {
		common.ApiError(c, err)
		return
	}

	recordManageAuditFor(c, 0, "monthly_quota_defaults.update", map[string]interface{}{
		"student":  defaults.Student,
		"graduate": defaults.Graduate,
		"teacher":  defaults.Teacher,
		"admin":    defaults.Admin,
	})
	common.ApiSuccess(c, model.GetSZUMonthlyQuotaDefaults())
}
