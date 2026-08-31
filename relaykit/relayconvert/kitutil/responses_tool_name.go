package kitutil

import (
	"strconv"
	"strings"
)

const responsesToolNamePrefix = "newapi_tool_"

// EncodeResponsesToolName creates a Chat Completions-safe function name that
// preserves the Responses API namespace and tool type across conversion.
func EncodeResponsesToolName(namespace string, name string, toolType string) string {
	typeCode := "f"
	if toolType == "custom" {
		typeCode = "c"
	}
	return responsesToolNamePrefix + typeCode + "_" + strconv.Itoa(len(namespace)) + "_" +
		namespace + "_" + name
}

// DecodeResponsesToolName reverses EncodeResponsesToolName. Names without the
// reserved prefix are ordinary Chat Completions function names.
func DecodeResponsesToolName(encoded string) (namespace string, name string, toolType string, ok bool) {
	if !strings.HasPrefix(encoded, responsesToolNamePrefix) {
		return "", "", "", false
	}

	rest := strings.TrimPrefix(encoded, responsesToolNamePrefix)
	typeEnd := strings.IndexByte(rest, '_')
	if typeEnd != 1 {
		return "", "", "", false
	}
	switch rest[:typeEnd] {
	case "f":
		toolType = "function"
	case "c":
		toolType = "custom"
	default:
		return "", "", "", false
	}
	rest = rest[typeEnd+1:]
	lengthEnd := strings.IndexByte(rest, '_')
	if lengthEnd <= 0 {
		return "", "", "", false
	}
	namespaceLength, err := strconv.Atoi(rest[:lengthEnd])
	if err != nil || namespaceLength < 0 {
		return "", "", "", false
	}
	rest = rest[lengthEnd+1:]
	if len(rest) <= namespaceLength || rest[namespaceLength] != '_' {
		return "", "", "", false
	}
	namespace = rest[:namespaceLength]
	name = rest[namespaceLength+1:]
	if name == "" {
		return "", "", "", false
	}
	return namespace, name, toolType, true
}
