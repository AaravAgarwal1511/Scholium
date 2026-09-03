const MOCK_USER = { id: 'mock-user-id', email: 'test@example.com' };

export const supabase = {
  auth: {
    getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
    getSession: async () => ({ data: { session: { user: MOCK_USER } }, error: null }),
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      setTimeout(() => cb('SIGNED_IN', { user: MOCK_USER }), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithPassword: async () => ({ data: { user: MOCK_USER }, error: null }),
    signUp: async () => ({ data: { user: MOCK_USER }, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
  },
  from: (_table: string) => {
    const builder: Record<string, unknown> = {
      data: [],
      error: null,
      select: () => builder,
      eq: () => builder,
      neq: () => builder,
      or: () => builder,
      is: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      single: () => ({ data: null, error: null }),
      maybeSingle: () => ({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => builder,
      delete: () => builder,
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return builder;
  },
};
