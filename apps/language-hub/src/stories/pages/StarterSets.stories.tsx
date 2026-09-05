import type { ContextType } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import StarterSets from '@/pages/StarterSets';

// Stub auth: a signed-in user, no real Supabase session. The page's own Supabase
// reads go through the client mock aliased in .storybook/main.ts.
const MOCK_AUTH = {
  user: { id: 'mock-user-id', email: 'test@example.com' },
  session: null,
  loading: false,
  signOut: async () => {},
} as unknown as ContextType<typeof AuthContext>;

const meta: Meta<typeof StarterSets> = {
  title: 'Pages/StarterSets',
  component: StarterSets,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <AuthContext.Provider value={MOCK_AUTH}>
        <MemoryRouter initialEntries={['/starter-sets']}>
          <Routes>
            <Route path="/starter-sets" element={<Story />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof StarterSets>;

export const Default: Story = {};
