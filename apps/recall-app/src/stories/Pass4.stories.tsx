import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import { Pass4 } from '@/components/study/Pass4';

const ECON_CARDS = [
  { term: 'GDP', definition: 'The total monetary value of all goods and services produced in a country in a given period, including all public and private consumption, government outlays, investments, and exports less imports.' },
  { term: 'Inflation', definition: 'A general increase in prices and fall in the purchasing value of money, measured as a percentage change in a price index over time.' },
  { term: 'Supply', definition: 'The total amount of a product or service available for purchase in a market at various prices during a given period.' },
];

const meta: Meta<typeof Pass4> = {
  title: 'Study/Pass4',
  component: Pass4,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { cards: ECON_CARDS, onComplete: () => {} },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Pass4>;

export const AwaitingReveal: Story = {};

export const PostRevealCorrect: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Write everything you can recall about this term...');
    await userEvent.type(textarea, 'The total monetary value of all goods and services produced in a country in a given period, including consumption, government outlays, and investments.');
    await userEvent.click(canvas.getByText('Reveal Answer'));
  },
};

export const PostRevealWrong: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Write everything you can recall about this term...');
    await userEvent.type(textarea, 'Something about money and production.');
    await userEvent.click(canvas.getByText('Reveal Answer'));
  },
};

export const ManualOverride: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Write everything you can recall about this term...');
    await userEvent.type(textarea, 'Something about money and production.');
    await userEvent.click(canvas.getByText('Reveal Answer'));
    const markBtn = await canvas.findByText('Mark Correct');
    await userEvent.click(markBtn);
  },
};
