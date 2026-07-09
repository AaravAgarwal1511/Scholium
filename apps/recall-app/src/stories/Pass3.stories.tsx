import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import { Pass3 } from '@/components/study/Pass3';

const ECON_CARDS = [
  { term: 'GDP', definition: 'The total monetary value of all goods and services produced in a country.' },
  { term: 'Inflation', definition: 'A general increase in prices and fall in the purchasing value of money.' },
  { term: 'Supply', definition: 'The total amount of a product or service available for purchase in a market.' },
  { term: 'Demand', definition: 'The consumer desire and willingness to pay for a specific good or service.' },
  { term: 'Elasticity', definition: 'The responsiveness of supply or demand to changes in price.' },
];

const meta: Meta<typeof Pass3> = {
  title: 'Study/Pass3',
  component: Pass3,
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
type Story = StoryObj<typeof Pass3>;

export const BlankInput: Story = {};

export const CorrectSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Type the term...');
    await userEvent.type(input, 'GDP');
    await userEvent.click(canvas.getByText('Check Answer'));
  },
};

export const WrongSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Type the term...');
    await userEvent.type(input, 'wrong answer');
    await userEvent.click(canvas.getByText('Check Answer'));
  },
};

export const ManualOverride: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('Type the term...');
    await userEvent.type(input, 'wrong answer');
    await userEvent.click(canvas.getByText('Check Answer'));
    await userEvent.click(canvas.getByText('Mark Correct'));
  },
};
