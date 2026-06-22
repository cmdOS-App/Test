// OSS build stub — no external sign-out call in open-source mode.
export async function revokeClerkSession(_userId: string): Promise<void> {
  // No-op: OSS builds do not call any remote sign-out endpoint.
}
