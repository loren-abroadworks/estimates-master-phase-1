import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PackageModal } from './PackageModal';

const pkgs = [{ id: 'a', name: 'Standard', description: 'Std desc' }, { id: 'b', name: 'Premium' }];
const templates = [{ id: 'pdt-1', name: 'Premium Interior', description: 'Premium blurb' }];

const baseProps = {
  isOpen: true as const,
  packages: pkgs,
  activeId: 'a',
  descriptionTemplates: templates,
  onClose: vi.fn(),
  onSaveTemplate: vi.fn(),
  onDeleteTemplate: vi.fn(),
};

describe('PackageModal', () => {
  it('add mode: submits name, description, and chosen source', () => {
    const onSubmit = vi.fn();
    render(<PackageModal {...baseProps} mode="add" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Package name'), { target: { value: 'Deluxe' } });
    // Pick the "start from" source first (this re-seeds the description), then write the blurb.
    fireEvent.change(screen.getByLabelText('Start from'), { target: { value: 'b' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'My blurb' } });
    fireEvent.click(screen.getByRole('button', { name: /create package/i }));
    expect(onSubmit).toHaveBeenCalledWith('Deluxe', 'My blurb', 'b');
  });

  it('add mode: pre-fills description from the default source package', () => {
    render(<PackageModal {...baseProps} mode="add" onSubmit={vi.fn()} />);
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Std desc');
  });

  it('choosing a template fills the description box', () => {
    render(<PackageModal {...baseProps} mode="add" onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Use template'), { target: { value: 'pdt-1' } });
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Premium blurb');
  });

  it('deletes the picked template via the delete control', () => {
    const onDeleteTemplate = vi.fn();
    render(<PackageModal {...baseProps} mode="add" onSubmit={vi.fn()} onDeleteTemplate={onDeleteTemplate} />);
    // No delete control until a template is picked.
    expect(screen.queryByLabelText('Delete template')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Use template'), { target: { value: 'pdt-1' } });
    fireEvent.click(screen.getByLabelText('Delete template'));
    expect(onDeleteTemplate).toHaveBeenCalledWith('pdt-1');
  });

  it('save as template calls onSaveTemplate with the typed name and description', () => {
    const onSaveTemplate = vi.fn();
    render(<PackageModal {...baseProps} mode="rename" initialName="Standard" initialDescription="Reusable text" onSubmit={vi.fn()} onSaveTemplate={onSaveTemplate} />);
    fireEvent.click(screen.getByRole('button', { name: /save as template/i }));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'My Template' } });
    fireEvent.click(screen.getByRole('button', { name: /^save template$/i }));
    expect(onSaveTemplate).toHaveBeenCalledWith('My Template', 'Reusable text');
  });

  it('rename mode: pre-fills name and description and submits both', () => {
    const onSubmit = vi.fn();
    render(<PackageModal {...baseProps} mode="rename" initialName="Standard" initialDescription="Existing" onSubmit={onSubmit} />);
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Existing');
    fireEvent.change(screen.getByLabelText('Package name'), { target: { value: 'Standard Plus' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSubmit).toHaveBeenCalledWith('Standard Plus', 'Existing', undefined);
  });

  it('does not submit an empty name and shows a required error', () => {
    const onSubmit = vi.fn();
    render(<PackageModal {...baseProps} mode="add" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Package name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /create package/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/package name is required/i);
  });
});
