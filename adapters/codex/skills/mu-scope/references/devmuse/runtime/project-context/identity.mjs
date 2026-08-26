function trimRepositoryPath(pathname) {
  return pathname.replace(/^\/+/, "").replace(/\.git\/?$/i, "").replace(/\/+$/, "");
}

export function normalizeRepositoryRemote(rawRemote) {
  if (typeof rawRemote !== "string" || rawRemote.trim() === "") return null;
  const raw = rawRemote.trim();
  const scp = raw.match(/^(?:[^@/:]+@)?([^/:?#]+):([^?#]+)(?:[?#].*)?$/);
  if (scp && !raw.includes("://")) {
    const repositoryPath = trimRepositoryPath(scp[2]);
    return repositoryPath ? `${scp[1].toLowerCase()}/${repositoryPath}` : null;
  }
  try {
    const candidate = raw.includes("://") ? raw : `https://${raw}`;
    const url = new URL(candidate);
    const repositoryPath = trimRepositoryPath(url.pathname);
    return url.hostname && repositoryPath ? `${url.hostname.toLowerCase()}/${repositoryPath}` : null;
  } catch {
    return null;
  }
}

export function resolveProjectIdentity({ manifestId = null, manifestRepository = null, liveRepositoryId = null, liveRepository = null } = {}) {
  const manifestTuple = normalizeRepositoryRemote(manifestRepository);
  const liveTuple = normalizeRepositoryRemote(liveRepository);
  if (manifestId && liveRepositoryId) {
    if (manifestId !== liveRepositoryId) {
      return { status: "identity-conflict", projectId: null, repository: null, remoteWrites: false, repair: "adopt-current-repository" };
    }
    // GitHub owner/repo are case-insensitive, so a pure case difference is not a
    // rename; compare case-folded to avoid a spurious "update-manifest" repair.
    const renamed = (manifestTuple ?? "").toLowerCase() !== (liveTuple ?? "").toLowerCase();
    return {
      status: renamed ? "verified-renamed" : "verified",
      projectId: liveRepositoryId,
      repository: liveTuple,
      remoteWrites: true,
      repair: renamed ? "update-manifest-repository" : null,
    };
  }
  if (manifestId) {
    return { status: "manifest-unverified", projectId: manifestId, repository: manifestTuple, remoteWrites: false, repair: null };
  }
  if (liveRepositoryId) {
    return { status: "verified-live", projectId: liveRepositoryId, repository: liveTuple, remoteWrites: true, repair: "offer-manifest" };
  }
  return { status: "unresolved", projectId: null, repository: null, remoteWrites: false, repair: null };
}
