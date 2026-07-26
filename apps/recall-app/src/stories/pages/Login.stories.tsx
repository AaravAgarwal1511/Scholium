import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/pages/Login';

const meta: Meta<typeof Login> = {
  title: 'Pages/Login',
  component: Login,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Login>;

export const SignInView: Story = {};

export const SignUpView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Copy comes from @repo/ui's AuthCard, not from this app.
    await userEvent.click(canvas.getByRole('button', { name: 'Create Account' }));
  },
};

export const ForgotPasswordView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Forgot Password?' }));
  },
};
