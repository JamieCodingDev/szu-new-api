package controller

import (
	"net/http"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	usageGuideCardsOptionKey  = "UsageGuideCards"
	maxUsageGuideContentBytes = 256 * 1024
)

var (
	usageGuideCardsMutex = sync.Mutex{}
	usageGuideCardIDs    = map[string]struct{}{
		"before-start":     {},
		"opencode":         {},
		"codex":            {},
		"claude-code":      {},
		"deepseek-harness": {},
	}
)

type usageGuideUpdateRequest struct {
	Content string `json:"content"`
}

func getUsageGuideCards() map[string]string {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[usageGuideCardsOptionKey]
	common.OptionMapRWMutex.RUnlock()

	cards := make(map[string]string)
	if strings.TrimSpace(raw) != "" {
		_ = common.UnmarshalJsonStr(raw, &cards)
	}
	return cards
}

func GetUsageGuide(c *gin.Context) {
	cards := getUsageGuideCards()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cards,
	})
}

func UpdateUsageGuideCard(c *gin.Context) {
	cardID := c.Param("card")
	if _, ok := usageGuideCardIDs[cardID]; !ok {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		maxUsageGuideContentBytes+1024,
	)

	var request usageGuideUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || len(request.Content) > maxUsageGuideContentBytes {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	usageGuideCardsMutex.Lock()
	defer usageGuideCardsMutex.Unlock()

	cards := getUsageGuideCards()
	if strings.TrimSpace(request.Content) == "" {
		delete(cards, cardID)
	} else {
		cards[cardID] = request.Content
	}
	raw, err := common.Marshal(cards)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOption(usageGuideCardsOptionKey, string(raw)); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cards,
	})
}
