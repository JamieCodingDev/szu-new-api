package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetSelfQuotaLedger exposes quota income only. Model usage remains on the
// usage page; this ledger contains the two allowed income sources: monthly
// free grants and redemption codes.
func GetSelfQuotaLedger(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	entries, total, err := model.GetSZUQuotaLedger(
		c.GetInt("id"),
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(total)
	pageInfo.SetItems(entries)
	common.ApiSuccess(c, pageInfo)
}
