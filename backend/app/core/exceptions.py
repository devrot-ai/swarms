"""Custom exception classes for structured error handling."""
from __future__ import annotations


class AppError(Exception):
    """Base application error with structured fields."""

    def __init__(self, code: str, message: str, status_code: int = 500, details: dict | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id: str):
        super().__init__(
            code="not_found",
            message=f"{resource} '{resource_id}' not found.",
            status_code=404,
            details={"resource": resource, "id": resource_id},
        )


class ValidationError(AppError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(
            code="validation_error",
            message=message,
            status_code=422,
            details=details or {},
        )


class PolicyDeniedError(AppError):
    def __init__(self, message: str = "Action denied by policy."):
        super().__init__(
            code="policy_denied",
            message=message,
            status_code=403,
        )


class ToolExecutionError(AppError):
    def __init__(self, tool_name: str, reason: str):
        super().__init__(
            code="tool_execution_error",
            message=f"Tool '{tool_name}' failed: {reason}",
            status_code=500,
            details={"tool": tool_name, "reason": reason},
        )


class AuthenticationError(AppError):
    def __init__(self, message: str = "Invalid or missing authentication credentials."):
        super().__init__(
            code="authentication_error",
            message=message,
            status_code=401,
        )


class AuthorizationError(AppError):
    def __init__(self, message: str = "Insufficient permissions."):
        super().__init__(
            code="authorization_error",
            message=message,
            status_code=403,
        )
