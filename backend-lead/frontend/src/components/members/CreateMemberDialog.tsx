'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { validateUsername } from '@/lib/validation';
import { useOperationsStore, selectBusy } from '@/store/operationsStore';

export function CreateMemberDialog({ label = 'New member' }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(92vw,420px)] rounded-lg border border-border bg-surface p-0 text-fg shadow-card backdrop:bg-black/40"
      >
        {open ? <CreateMemberForm onDone={() => setOpen(false)} /> : null}
      </dialog>
    </>
  );
}

export function CreateMemberForm({ onDone }: { onDone?: () => void }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createMember = useOperationsStore((s) => s.createMember);
  const busy = useOperationsStore(selectBusy('createMember'));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const check = validateUsername(username);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    const out = await createMember(check.value);
    if (out.ok) {
      setUsername('');
      onDone?.();
    } else {
      setError(out.error);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-base font-semibold">Create a member</h2>
        <p className="mt-0.5 text-xs text-fg-muted">Opens an empty wallet for them and makes them the active member.</p>
      </div>
      <Field label="Username" htmlFor="new-member-username" hint="3 to 64 characters." error={error}>
        <Input
          id="new-member-username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="alice01"
          invalid={Boolean(error)}
          autoComplete="off"
        />
      </Field>
      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={busy}>
          Create member
        </Button>
      </div>
    </form>
  );
}
