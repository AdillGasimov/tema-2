// Optimizer sources must explicitly require public access. Even a signed-in
// administrator must not turn a private draft preview into a shared rendition.
export const publicImageSrc = (key: string) => `/api/media/${key}?public=1`;
