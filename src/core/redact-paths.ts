export const splitRedactionPath = (path: string) =>
  path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

export const matchesRedactionPath = (pattern: string, path: readonly string[]) => {
  const patternSegments = splitRedactionPath(pattern);

  const matches = (patternIndex: number, pathIndex: number): boolean => {
    const segment = patternSegments[patternIndex];

    if (segment === undefined) {
      return pathIndex === path.length;
    }

    if (segment === '**') {
      return (
        matches(patternIndex + 1, pathIndex) ||
        (pathIndex < path.length && matches(patternIndex, pathIndex + 1))
      );
    }

    return (
      pathIndex < path.length &&
      (segment === '*' || segment === path[pathIndex]) &&
      matches(patternIndex + 1, pathIndex + 1)
    );
  };

  return matches(0, 0);
};
