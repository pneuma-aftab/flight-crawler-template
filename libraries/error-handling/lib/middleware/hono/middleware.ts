import type { ErrorHandler } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import { errorHandler } from '../../error-handler';

export const handleHTTPError = (): ErrorHandler => (error, c) => {
  // ✅ Best Practice: Pass all error to a centralized error handler so they get treated equally
  const appError = errorHandler.handleError(error);

  return c.json(
    {
      code: appError.code,
      errorType: appError.errorType,
      fieldValidationIssues: appError.fieldValidationIssues,
    },
    //@ts-expect-error Invalid Status Code Type
    (appError.HTTPStatus || 500) as StatusCode
  );
};
