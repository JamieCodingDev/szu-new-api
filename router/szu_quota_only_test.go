package router

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSZUQuotaOnlyModeDoesNotRegisterLegacyQuotaSources(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	require.NotPanics(t, func() {
		SetApiRouter(engine)
	})

	routes := make(map[string]struct{})
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = struct{}{}
	}

	disabledRoutes := []string{
		"POST /api/user/pay",
		"POST /api/user/stripe/pay",
		"POST /api/user/aff_transfer",
		"POST /api/user/checkin",
		"POST /api/subscription/balance/pay",
		"POST /api/subscription/stripe/pay",
		"POST /api/subscription/admin/bind",
		"GET /api/subscription/self",
		"DELETE /api/redemption/invalid",
		"DELETE /api/redemption/:id",
		"GET /api/token/auto-groups",
	}
	for _, route := range disabledRoutes {
		_, exists := routes[route]
		assert.False(t, exists, "legacy quota source route must be disabled: %s", route)
	}

	_, redemptionExists := routes["POST /api/user/topup"]
	assert.True(t, redemptionExists, "redemption-code quota source must remain available")
	_, ledgerExists := routes["GET /api/user/self/quota-ledger"]
	assert.True(t, ledgerExists, "the two-source quota income ledger must be available")
}
