export function some<T>(val: T): Option<Exclude<T, undefined>> {
  return new Option(val) as Option<Exclude<T, undefined>>;
}

export function none<T>(): Option<T> {
  return new Option<T>(undefined);
}

export class Option<T> {
  private val: T | undefined;

  constructor(val: T | undefined) {
    this.val = val;
  }

  transform(f: (val: T) => T): Option<T> {
    if (this.val === undefined) {
      return this;
    }

    return new Option(f(this.val));
  }

  edit(f: (val: T) => void): Option<T> {
    if (this.val !== undefined) {
      f(this.val);
    }

    return this;
  }

  map<R>(f: (val: T) => R): Option<Exclude<R, undefined>> {
    if (this.val === undefined) {
      return none();
    }
    return new Option(f(this.val)) as Option<Exclude<R, undefined>>;
  }

  is_some() {
    return !(this.val === undefined);
  }

  is_some_and(f: (val: T) => boolean): boolean {
    if (this.val === undefined) {
      return false;
    }

    return f(this.val);
  }

  is_none() {
    return this.val === undefined;
  }

  match<R>(cases: { Some: (val: T) => R; None: () => R }): R {
    if (this.val === undefined) {
      return cases.None();
    }

    return cases.Some(this.val);
  }

  unwrap(): T {
    if (this.val === undefined) {
      throw new Error("Unwrapped a none option");
    }

    return this.val;
  }

  unwrap_or(fallback: T): T {
    if (this.val === undefined) {
      return fallback;
    }

    return this.val;
  }

  unwrap_or_else(fallback: () => T) {
    if (this.val === undefined) {
      return fallback();
    }

    return this.val;
  }

  equals(other: Option<T>) {
    return this.val === other.val;
  }
}
