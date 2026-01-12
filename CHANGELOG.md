# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-01-12

### Added
- **WebSocket Streaming**: Implemented WebSocket streaming for practice material generation to improve user experience with real-time progress updates.
  - Added `generate_practice_material` action to WebSocket handler.
  - Added `textbook_id` and `topic` validation.
  - created `usePracticeMaterialStream` hook for frontend state management.
- **Lambda Warmup**: Added mechanism to pre-warm Lambda functions to reduce cold start latency.
  - Added `warmup` action to WebSocket handler.
  - Implemented `warmupLambdas` function in frontend to trigger warmup on app load.
  - Added warmup handler in `practiceMaterial` Lambda.
- **Bedrock Guardrails**: Integrated Bedrock Guardrails for content safety.
  - Added `GUARDRAIL_ID_PARAM` and `bedrock:ApplyGuardrail` permissions.
  - Implemented input guardrails on topics and output guardrails on generated content.
  - Implemented fail-closed security model (blocks content on guardrail errors).
  - Switched to published guardrail version "1".

### Changed
- **UI Improvements**:
  - Added connection status warning in `PracticeMaterialPage`.
  - Improved `Progress` component accessibility.
- **Configuration**:
  - Increased `max_tokens` to 4096 for practice material generation.
  - Increased practice material Lambda timeout to 10 minutes (600s) to support large generations.
  - Updated API Gateway logging configuration (verified enabled).

### Security
- Fixed potential race condition in token refresh logic.
- Implemented robust error handling for guardrail failures, distinguishing between technical errors and policy violations.
