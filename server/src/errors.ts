export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}
export const bad = (m: string) => new HttpError(400, m)
export const forbidden = (m = 'Không có quyền thực hiện thao tác này') => new HttpError(403, m)
export const notFound = (m: string) => new HttpError(404, m)
export const conflict = (m: string) => new HttpError(409, m)
export const unprocessable = (m: string) => new HttpError(422, m)
