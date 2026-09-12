import { useEffect, useState } from 'react';
import { errorMessage } from '../../../format';
import { meterFraction } from '../../../noise';
import { useIntl } from '../../../intl/setup';

const METER_BAR_COUNT = 36;

export function AudioMeter({ value }: { value: number }) {
  const t = useIntl();
  const fraction = meterFraction(value);
  return (
    <div
      className="meter"
      role="meter"
      aria-label={t('common.audioLevel')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
    >
      {Array.from({ length: METER_BAR_COUNT }, (_, index) => (
        <span
          key={index}
          className={index < fraction * METER_BAR_COUNT ? 'lit' : ''}
          style={{ height: `${10 + Math.sin(index * 0.65) ** 2 * 17}px` }}
        />
      ))}
    </div>
  );
}

export function RenameField({
  label,
  testId,
  value,
  onSave,
}: {
  label: string;
  testId: string;
  value: string;
  onSave: (name: string) => Promise<unknown>;
}) {
  const t = useIntl();
  const [name, setName] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setName(value), [value]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(name.trim());
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="rename-field" data-testid={testId} onSubmit={submit}>
      <label>
        {label}
        <input
          required
          maxLength={40}
          data-testid={`${testId}-input`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="secondary small"
        data-testid={`${testId}-save`}
        disabled={busy || !name.trim() || name.trim() === value}
      >
        {t('common.save')}
      </button>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
    </form>
  );
}
