package ratio_setting

import "testing"

func TestDeepSeekV4FlashUsesPointBillingRatios(t *testing.T) {
	InitRatioSettings()

	for _, model := range []string{"deepseek-v4-flash", "deepseek-v4-flash:latest"} {
		inputRatio, ok, _ := GetModelRatio(model)
		if !ok || inputRatio != 1 {
			t.Fatalf("%s input ratio = %v, found = %v; want 1, true", model, inputRatio, ok)
		}
		if outputRatio := GetCompletionRatio(model); outputRatio != 10 {
			t.Fatalf("%s output ratio = %v; want 10", model, outputRatio)
		}
		outputInfo := GetCompletionRatioInfo(model)
		if outputInfo.Ratio != 10 || !outputInfo.Locked {
			t.Fatalf("%s output info = %+v; want ratio 10 locked", model, outputInfo)
		}
		if cacheRatio, ok := GetCacheRatio(model); !ok || cacheRatio != 1 {
			t.Fatalf("%s cache ratio = %v, found = %v; want 1, true", model, cacheRatio, ok)
		}
		if cacheCreationRatio, ok := GetCreateCacheRatio(model); !ok || cacheCreationRatio != 1 {
			t.Fatalf("%s cache creation ratio = %v, found = %v; want 1, true", model, cacheCreationRatio, ok)
		}
	}
}
