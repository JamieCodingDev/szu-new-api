package ratio_setting

import "testing"

func TestDeepSeekV4FlashUsesPointBillingRatios(t *testing.T) {
	InitRatioSettings()

	for _, model := range []string{"deepseek-v4-flash", "deepseek-v4-flash:latest"} {
		inputRatio, ok, _ := GetModelRatio(model)
		if !ok || inputRatio != 1 {
			t.Fatalf("%s input ratio = %v, found = %v; want 1, true", model, inputRatio, ok)
		}
		if outputRatio := GetCompletionRatio(model); outputRatio != 2 {
			t.Fatalf("%s output ratio = %v; want 2", model, outputRatio)
		}
	}
}
