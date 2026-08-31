package model

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func clearSZUDeepSeekChannelEnvironment(t *testing.T) {
	t.Helper()
	t.Setenv("SZU_DEEPSEEK_BASE_URL", "")
	t.Setenv("SZU_DEEPSEEK_UPSTREAM_MODEL", "")
	t.Setenv("SZU_DEEPSEEK_API_KEY", "")
}

func TestEnsureSZUDeepSeekChannelCreatesChannelAndAbility(t *testing.T) {
	truncateTables(t)
	clearSZUDeepSeekChannelEnvironment(t)

	require.NoError(t, EnsureSZUDeepSeekChannel())

	var channel Channel
	require.NoError(t, DB.Where("name = ?", SZUDeepSeekChannelName).First(&channel).Error)
	assert.Equal(t, constant.ChannelTypeAdvancedCustom, channel.Type)
	assert.Equal(t, common.ChannelStatusEnabled, channel.Status)
	assert.Equal(t, defaultSZUDeepSeekAPIKey, channel.Key)
	assert.Equal(t, defaultSZUDeepSeekBaseURL, *channel.BaseURL)
	assert.Equal(t, SZUDeepSeekPublicModel, channel.Models)
	assert.Equal(t, defaultSZUDeepSeekGroup, channel.Group)

	advancedCustom := channel.GetOtherSettings().AdvancedCustom
	require.NotNil(t, advancedCustom)
	require.NoError(t, advancedCustom.Validate())
	require.Len(t, advancedCustom.Routes, 3)
	assert.Equal(t, "/v1/chat/completions", advancedCustom.Routes[0].IncomingPath)
	assert.Equal(t, "/v1/chat/completions", advancedCustom.Routes[0].UpstreamPath)
	assert.Equal(t, "none", advancedCustom.Routes[0].Converter)
	assert.Equal(t, "/v1/responses", advancedCustom.Routes[1].IncomingPath)
	assert.Equal(t, "/v1/chat/completions", advancedCustom.Routes[1].UpstreamPath)
	assert.Equal(t, "openai_responses_to_openai_chat_completions", advancedCustom.Routes[1].Converter)
	assert.Equal(t, "/v1/messages", advancedCustom.Routes[2].IncomingPath)
	assert.Equal(t, "/v1/chat/completions", advancedCustom.Routes[2].UpstreamPath)
	assert.Equal(t, "anthropic_messages_to_openai_chat_completions", advancedCustom.Routes[2].Converter)

	var mapping map[string]string
	require.NoError(t, json.Unmarshal([]byte(*channel.ModelMapping), &mapping))
	assert.Equal(t, defaultSZUDeepSeekModel, mapping[SZUDeepSeekPublicModel])

	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	assert.Equal(t, defaultSZUDeepSeekGroup, ability.Group)
	assert.Equal(t, SZUDeepSeekPublicModel, ability.Model)
	assert.True(t, ability.Enabled)
}

func TestEnsureSZUDeepSeekChannelIsIdempotentAndRepairsConfiguration(t *testing.T) {
	truncateTables(t)
	clearSZUDeepSeekChannelEnvironment(t)
	require.NoError(t, EnsureSZUDeepSeekChannel())

	var original Channel
	require.NoError(t, DB.Where("name = ?", SZUDeepSeekChannelName).First(&original).Error)
	wrongBaseURL := "http://wrong.invalid"
	wrongMapping := `{"wrong":"model"}`
	require.NoError(t, DB.Model(&original).Updates(map[string]any{
		"type":          constant.ChannelTypeOllama,
		"key":           "wrong",
		"status":        2,
		"base_url":      wrongBaseURL,
		"models":        "wrong-model",
		"group":         "wrong-group",
		"model_mapping": wrongMapping,
		"settings":      "{}",
	}).Error)
	require.NoError(t, DB.Where("channel_id = ?", original.Id).Delete(&Ability{}).Error)

	t.Setenv("SZU_DEEPSEEK_BASE_URL", "http://llama.internal:8000/")
	t.Setenv("SZU_DEEPSEEK_UPSTREAM_MODEL", "deepseek-custom")
	t.Setenv("SZU_DEEPSEEK_API_KEY", "internal-key")
	require.NoError(t, EnsureSZUDeepSeekChannel())
	require.NoError(t, EnsureSZUDeepSeekChannel())

	var channels []Channel
	require.NoError(t, DB.Where("name = ?", SZUDeepSeekChannelName).Find(&channels).Error)
	require.Len(t, channels, 1)
	channel := channels[0]
	assert.Equal(t, original.Id, channel.Id)
	assert.Equal(t, constant.ChannelTypeAdvancedCustom, channel.Type)
	assert.Equal(t, common.ChannelStatusEnabled, channel.Status)
	assert.Equal(t, "internal-key", channel.Key)
	assert.Equal(t, "http://llama.internal:8000", *channel.BaseURL)
	assert.Equal(t, SZUDeepSeekPublicModel, channel.Models)
	assert.Equal(t, defaultSZUDeepSeekGroup, channel.Group)

	var mapping map[string]string
	require.NoError(t, json.Unmarshal([]byte(*channel.ModelMapping), &mapping))
	assert.Equal(t, "deepseek-custom", mapping[SZUDeepSeekPublicModel])
	advancedCustom := channel.GetOtherSettings().AdvancedCustom
	require.NotNil(t, advancedCustom)
	require.NoError(t, advancedCustom.Validate())
	require.Len(t, advancedCustom.Routes, 3)
	assert.Equal(t, "/v1/responses", advancedCustom.Routes[1].IncomingPath)
	assert.Equal(t, "/v1/chat/completions", advancedCustom.Routes[1].UpstreamPath)

	var abilities []Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).Find(&abilities).Error)
	require.Len(t, abilities, 1)
	assert.Equal(t, defaultSZUDeepSeekGroup, abilities[0].Group)
	assert.Equal(t, SZUDeepSeekPublicModel, abilities[0].Model)
	assert.True(t, abilities[0].Enabled)
}

func TestEnsureSZUDeepSeekChannelRejectsInvalidBaseURL(t *testing.T) {
	truncateTables(t)
	t.Setenv("SZU_DEEPSEEK_BASE_URL", "deepseek-infer.incus:8000")

	err := EnsureSZUDeepSeekChannel()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "SZU_DEEPSEEK_BASE_URL")
}
