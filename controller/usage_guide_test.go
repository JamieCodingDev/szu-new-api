package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetUsageGuideReturnsConfiguredContent(t *testing.T) {
	previousOptionMap := common.OptionMap
	common.OptionMap = map[string]string{
		usageGuideCardsOptionKey: `{"opencode":"{\"title\":\"Custom OpenCode\"}"}`,
	}
	t.Cleanup(func() { common.OptionMap = previousOptionMap })

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/usage-guide", nil)

	GetUsageGuide(context)

	var response struct {
		Success bool              `json:"success"`
		Data    map[string]string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, `{"title":"Custom OpenCode"}`, response.Data["opencode"])
}

func TestUpdateUsageGuidePersistsContent(t *testing.T) {
	previousDB := model.DB
	previousOptionMap := common.OptionMap
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	model.DB = db
	common.OptionMap = map[string]string{}
	t.Cleanup(func() {
		model.DB = previousDB
		common.OptionMap = previousOptionMap
	})

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/usage-guide/opencode",
		strings.NewReader(`{"content":"{\"title\":\"Updated OpenCode\"}"}`),
	)
	context.Request.Header.Set("Content-Type", "application/json")
	context.Params = gin.Params{{Key: "card", Value: "opencode"}}

	UpdateUsageGuideCard(context)

	assert.Equal(t, http.StatusOK, recorder.Code)
	var storedCards map[string]string
	require.NoError(t, common.UnmarshalJsonStr(common.OptionMap[usageGuideCardsOptionKey], &storedCards))
	assert.Equal(t, `{"title":"Updated OpenCode"}`, storedCards["opencode"])
	var option model.Option
	require.NoError(t, db.First(&option, "key = ?", usageGuideCardsOptionKey).Error)
	require.NoError(t, common.UnmarshalJsonStr(option.Value, &storedCards))
	assert.Equal(t, `{"title":"Updated OpenCode"}`, storedCards["opencode"])
}
