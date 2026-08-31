package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatCompletionsResponseToResponsesPreservesTextToolCallsAndUsage(t *testing.T) {
	chat := &dto.OpenAITextResponse{
		Id:      "chatcmpl_1",
		Model:   "gpt-test",
		Created: 456,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Message:      assistantMessageWithTool("I will call.", "call_1", "lookup", `{"q":"x"}`),
				FinishReason: "tool_calls",
			},
		},
		Usage: dto.Usage{PromptTokens: 3, CompletionTokens: 5, TotalTokens: 8},
	}

	resp, usage, err := ChatCompletionsResponseToResponsesResponse(chat, "resp_1")
	require.NoError(t, err)
	require.NotNil(t, usage)

	assert.Equal(t, "resp_1", resp.ID)
	assert.Equal(t, "response", resp.Object)
	assert.Equal(t, `"completed"`, string(resp.Status))
	assert.Equal(t, 3, resp.Usage.InputTokens)
	assert.Equal(t, 5, resp.Usage.OutputTokens)
	require.Len(t, resp.Output, 2)
	assert.Equal(t, responsesOutputTypeMessage, resp.Output[0].Type)
	assert.Equal(t, "I will call.", resp.Output[0].Content[0].Text)
	assert.Equal(t, responsesOutputTypeFunctionCall, resp.Output[1].Type)
	assert.Equal(t, "call_1", resp.Output[1].CallId)
	assert.Equal(t, "lookup", resp.Output[1].Name)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(resp.Output[1].Arguments))
}

func TestChatCompletionsResponseToResponsesMapsIncompleteFinishReasons(t *testing.T) {
	tests := []struct {
		name         string
		finishReason string
		wantReason   string
	}{
		{name: "length", finishReason: "length", wantReason: responsesIncompleteReasonMaxTokens},
		{name: "content filter", finishReason: "content_filter", wantReason: responsesIncompleteReasonContentFilter},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, _, err := ChatCompletionsResponseToResponsesResponse(&dto.OpenAITextResponse{
				Id:    "chatcmpl_1",
				Model: "gpt-test",
				Choices: []dto.OpenAITextResponseChoice{
					{
						Message:      dto.Message{Role: "assistant", Content: "partial"},
						FinishReason: tt.finishReason,
					},
				},
			}, "resp_1")
			require.NoError(t, err)

			assert.Equal(t, `"incomplete"`, string(resp.Status))
			require.NotNil(t, resp.IncompleteDetails)
			assert.Equal(t, tt.wantReason, resp.IncompleteDetails.Reason)
			require.Len(t, resp.Output, 1)
			assert.Equal(t, "incomplete", resp.Output[0].Status)
		})
	}
}

func TestChatCompletionsStreamToResponsesEventsAggregatesUsageAndToolArgs(t *testing.T) {
	state := NewChatToResponsesStreamState("resp_1", "gpt-test")
	state.Created = 123
	toolIndex := 0

	var events []ChatToResponsesStreamEvent
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Id:      "chatcmpl_1",
		Model:   "gpt-test",
		Created: 123,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant"}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: lo.ToPtr("hello")}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: &toolIndex, ID: "call_1", Type: "function", Function: dto.FunctionResponse{Name: "lookup"}},
			}}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: &toolIndex, Function: dto.FunctionResponse{Arguments: `{"q":"x"}`}},
			}}},
		},
	})...)
	finishReason := "tool_calls"
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, FinishReason: &finishReason},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Usage: &dto.Usage{PromptTokens: 2, CompletionTokens: 4, TotalTokens: 6},
	})...)
	events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

	require.Len(t, events, 12)
	assert.Equal(t, []string{
		responsesEventCreated,
		responsesEventOutputItemAdded,
		responsesEventContentPartAdded,
		responsesEventOutputTextDelta,
		responsesEventOutputItemAdded,
		responsesEventFunctionArgsDelta,
		responsesEventOutputTextDone,
		responsesEventContentPartDone,
		responsesEventOutputItemDone,
		responsesEventFunctionArgsDone,
		responsesEventOutputItemDone,
		responsesEventCompleted,
	}, responseEventTypes(events))
	for index, event := range events {
		require.NotNil(t, event.Payload.SequenceNumber)
		assert.Equal(t, index, *event.Payload.SequenceNumber)
	}

	assert.Equal(t, "hello", events[3].Payload.Delta)
	assert.Equal(t, "hello", events[6].Payload.Text)
	require.NotNil(t, events[7].Payload.Part)
	assert.Equal(t, "output_text", events[7].Payload.Part.Type)
	assert.Equal(t, "hello", events[7].Payload.Part.Text)
	assert.Equal(t, `{"q":"x"}`, events[5].Payload.Delta)
	assert.Equal(t, `{"q":"x"}`, events[9].Payload.Arguments)

	completed := events[11].Payload.Response
	require.NotNil(t, completed)
	assert.Equal(t, 6, completed.Usage.TotalTokens)
	require.Len(t, completed.Output, 2)
	assert.Equal(t, "hello", completed.Output[0].Content[0].Text)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(completed.Output[1].Arguments))
}

func TestChatCompletionsStreamToResponsesRestoresNamespacedCustomTool(t *testing.T) {
	state := NewChatToResponsesStreamState("resp_custom", "gpt-test")
	toolIndex := 0
	encodedName := kitutil.EncodeResponsesToolName("collaboration", "apply_patch", "custom")

	events := mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{
					Index: &toolIndex,
					ID:    "call_custom",
					Type:  "function",
					Function: dto.FunctionResponse{
						Name:      encodedName,
						Arguments: `{"input":"patch body"}`,
					},
				},
			}}},
		},
	})
	finishReason := "tool_calls"
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{{Index: 0, FinishReason: &finishReason}},
	})...)
	events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

	assert.Equal(t, []string{
		responsesEventCreated,
		responsesEventOutputItemAdded,
		responsesEventCustomToolInputDelta,
		responsesEventCustomToolInputDone,
		responsesEventOutputItemDone,
		responsesEventCompleted,
	}, responseEventTypes(events))
	assert.Equal(t, "patch body", events[2].Payload.Delta)
	assert.Equal(t, "patch body", events[3].Payload.Input)
	require.NotNil(t, events[4].Payload.Item)
	assert.Equal(t, responsesOutputTypeCustomToolCall, events[4].Payload.Item.Type)
	assert.Equal(t, "collaboration", events[4].Payload.Item.Namespace)
	assert.Equal(t, "apply_patch", events[4].Payload.Item.Name)
	assert.Equal(t, "patch body", events[4].Payload.Item.Input)
}

func responseEventTypes(events []ChatToResponsesStreamEvent) []string {
	types := make([]string, 0, len(events))
	for _, event := range events {
		types = append(types, event.Type)
	}
	return types
}

func mustResponsesEventsFromChatChunk(t *testing.T, state *ChatToResponsesStreamState, chunk *dto.ChatCompletionsStreamResponse) []ChatToResponsesStreamEvent {
	t.Helper()
	events, err := ChatCompletionsStreamChunkToResponsesEvents(chunk, state)
	require.NoError(t, err)
	return events
}
