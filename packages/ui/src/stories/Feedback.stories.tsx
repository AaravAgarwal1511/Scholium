import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { FeedbackDialog } from '../FeedbackDialog';
import { FeedbackPrompt } from '../FeedbackPrompt';

const meta: Meta<typeof FeedbackDialog> = {
  title: 'Components/Feedback',
  component: FeedbackDialog,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    appName: 'Recall',
    onClose: fn(),
    onSubmit: fn(async () => {}),
  },
};
export default meta;
type Story = StoryObj<typeof FeedbackDialog>;

export const Dialog: Story = {};

export const PrefilledFromPrompt: Story = {
  args: { initialRating: 4 },
};

export const PrefilledFromError: Story = {
  args: {
    initialCategory: 'bug',
    initialMessage: '\n\n---\nError: Cannot read properties of undefined (reading "cards")',
  },
};

export const SubmitsTrimmedValues: Story = {
  play: async ({ args, canvasElement }) => {
    // The native <dialog> renders in the top layer but stays inside the canvas DOM.
    const canvas = within(canvasElement.ownerDocument.body);
    // The radios are visually hidden; people click their labels, so the test does too.
    await userEvent.click(canvas.getByText('Idea'));
    await userEvent.click(canvas.getByLabelText('5 out of 5').closest('label')!);
    await userEvent.type(canvas.getByLabelText('Your message'), '  Dark mode for PDFs  ');
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await expect(args.onSubmit).toHaveBeenCalledWith({
      category: 'idea',
      rating: 5,
      message: 'Dark mode for PDFs',
      website: '',
    });
    await expect(await canvas.findByText('Thanks for your feedback')).toBeVisible();
  },
};

export const ShowsServerError: Story = {
  args: {
    onSubmit: fn(async () => {
      throw new Error("You've sent a lot of feedback recently. Please try again later.");
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.type(canvas.getByLabelText('Your message'), 'hi');
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await expect(await canvas.findByText(/sent a lot of feedback/)).toBeVisible();
  },
};

export const Prompt: StoryObj<typeof FeedbackPrompt> = {
  render: () => (
    <div style={{ minHeight: 320 }}>
      <FeedbackPrompt appName="Recall" onRate={fn()} onOpenForm={fn()} onDismiss={fn()} />
    </div>
  ),
};
