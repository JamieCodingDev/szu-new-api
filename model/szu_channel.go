package model

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"gorm.io/gorm"
)

const (
	SZUDeepSeekChannelName    = "SZU DeepSeek V4 Flash"
	SZUDeepSeekPublicModel    = "deepseek-v4-flash"
	defaultSZUDeepSeekBaseURL = "http://deepseek-infer.incus:8000"
	defaultSZUDeepSeekModel   = "deepseek-v4-flash"
	defaultSZUDeepSeekAPIKey  = "local"
	defaultSZUDeepSeekGroup   = "default"
)

type szuDeepSeekChannelConfig struct {
	BaseURL       string
	UpstreamModel string
	APIKey        string
}

func loadSZUDeepSeekChannelConfig() (szuDeepSeekChannelConfig, error) {
	config := szuDeepSeekChannelConfig{
		BaseURL:       strings.TrimRight(strings.TrimSpace(os.Getenv("SZU_DEEPSEEK_BASE_URL")), "/"),
		UpstreamModel: strings.TrimSpace(os.Getenv("SZU_DEEPSEEK_UPSTREAM_MODEL")),
		APIKey:        strings.TrimSpace(os.Getenv("SZU_DEEPSEEK_API_KEY")),
	}
	if config.BaseURL == "" {
		config.BaseURL = defaultSZUDeepSeekBaseURL
	}
	if config.UpstreamModel == "" {
		config.UpstreamModel = defaultSZUDeepSeekModel
	}
	if config.APIKey == "" {
		config.APIKey = defaultSZUDeepSeekAPIKey
	}

	parsedURL, err := url.Parse(config.BaseURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" {
		return szuDeepSeekChannelConfig{}, fmt.Errorf("invalid SZU_DEEPSEEK_BASE_URL %q", config.BaseURL)
	}
	if strings.Contains(config.UpstreamModel, ",") {
		return szuDeepSeekChannelConfig{}, errors.New("SZU_DEEPSEEK_UPSTREAM_MODEL must contain exactly one model")
	}
	return config, nil
}

// EnsureSZUDeepSeekChannel creates the built-in SZU llama.cpp channel and
// repairs its protocol routes on every master-node startup. Chat Completions
// stays native, while Responses and Anthropic Messages are converted to the
// llama.cpp Chat Completions endpoint. Channels created by administrators are
// intentionally left untouched.
func EnsureSZUDeepSeekChannel() error {
	if DB == nil {
		return errors.New("database is not initialized")
	}

	config, err := loadSZUDeepSeekChannelConfig()
	if err != nil {
		return err
	}
	modelMapping, err := common.Marshal(map[string]string{
		SZUDeepSeekPublicModel: config.UpstreamModel,
	})
	if err != nil {
		return fmt.Errorf("marshal SZU DeepSeek model mapping: %w", err)
	}
	mapping := string(modelMapping)
	advancedCustom := &dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "/v1/chat/completions",
				Converter:    relayconvert.ConverterNone,
			},
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    relayconvert.ConverterOpenAIResponsesToOpenAIChat,
			},
			{
				IncomingPath: "/v1/messages",
				UpstreamPath: "/v1/chat/completions",
				Converter:    relayconvert.ConverterClaudeMessagesToOpenAIChat,
			},
		},
	}
	if err := advancedCustom.Validate(); err != nil {
		return fmt.Errorf("validate SZU DeepSeek routes: %w", err)
	}
	otherSettings, err := common.Marshal(dto.ChannelOtherSettings{
		AdvancedCustom: advancedCustom,
	})
	if err != nil {
		return fmt.Errorf("marshal SZU DeepSeek routes: %w", err)
	}
	settings := string(otherSettings)

	return DB.Transaction(func(tx *gorm.DB) error {
		var channel Channel
		query := tx.Where("name = ?", SZUDeepSeekChannelName).Order("id ASC").Limit(1).Find(&channel)
		if query.Error != nil {
			return fmt.Errorf("query SZU DeepSeek channel: %w", query.Error)
		}

		if query.RowsAffected == 0 {
			channel = Channel{
				Type:          constant.ChannelTypeAdvancedCustom,
				Key:           config.APIKey,
				Status:        common.ChannelStatusEnabled,
				Name:          SZUDeepSeekChannelName,
				CreatedTime:   common.GetTimestamp(),
				BaseURL:       &config.BaseURL,
				Models:        SZUDeepSeekPublicModel,
				Group:         defaultSZUDeepSeekGroup,
				ModelMapping:  &mapping,
				OtherSettings: settings,
			}
			if err := tx.Create(&channel).Error; err != nil {
				return fmt.Errorf("create SZU DeepSeek channel: %w", err)
			}
			if err := channel.AddAbilities(tx); err != nil {
				return fmt.Errorf("create SZU DeepSeek ability: %w", err)
			}
			return nil
		}

		channel.Type = constant.ChannelTypeAdvancedCustom
		channel.Key = config.APIKey
		channel.Status = common.ChannelStatusEnabled
		channel.BaseURL = &config.BaseURL
		channel.Models = SZUDeepSeekPublicModel
		channel.Group = defaultSZUDeepSeekGroup
		channel.ModelMapping = &mapping
		channel.OtherSettings = settings
		if err := tx.Model(&channel).Select(
			"type",
			"key",
			"status",
			"base_url",
			"models",
			"group",
			"model_mapping",
			"settings",
		).Updates(&channel).Error; err != nil {
			return fmt.Errorf("repair SZU DeepSeek channel: %w", err)
		}
		if err := channel.UpdateAbilities(tx); err != nil {
			return fmt.Errorf("repair SZU DeepSeek ability: %w", err)
		}
		return nil
	})
}
