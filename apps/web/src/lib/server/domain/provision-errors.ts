export interface KnownErrorEntry {
  pattern: RegExp;
  diagnostic: string;
  solutions: string[];
}

export interface ResolvedError {
  diagnostic: string;
  solutions: string[];
}

export const KNOWN_PROVISION_ERRORS: KnownErrorEntry[] = [
  {
    pattern: /sudo.*(?:password|not in sudoers)|must be run as root/i,
    diagnostic:
      "The SSH user cannot run privileged commands without a password.",
    solutions: [
      'Connect as the root user instead (set SSH user to "root").',
      'Grant passwordless sudo to USERNAME: run `echo "USERNAME ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/benisploy` on the target machine.',
    ],
  },
];

export function resolveKnownErrors(
  rawMessage: string,
  username: string,
): ResolvedError[] {
  return KNOWN_PROVISION_ERRORS.filter((entry) =>
    entry.pattern.test(rawMessage),
  ).map((entry) => ({
    diagnostic: entry.diagnostic,
    solutions: entry.solutions.map((s) => s.replace(/USERNAME/g, username)),
  }));
}
