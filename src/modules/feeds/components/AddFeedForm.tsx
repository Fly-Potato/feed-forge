import { useState, type FormEvent } from "react";

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

interface AddFeedFormProps {
  onAdd: (url: string) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
}

export function AddFeedForm({ onAdd, onBusyChange }: AddFeedFormProps) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = url.trim();
    if (!value) {
      setError("请输入订阅源地址。");
      return;
    }

    setSubmitting(true);
    onBusyChange?.(true);
    setError(null);
    try {
      await onAdd(value);
      setUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "添加订阅源失败。");
    } finally {
      setSubmitting(false);
      onBusyChange?.(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="feed-url">订阅源地址</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="feed-url"
              name="url"
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(event) => setUrl(event.currentTarget.value)}
              disabled={submitting}
              aria-invalid={Boolean(error)}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="default" disabled={submitting}>
                {submitting ? "正在添加..." : "添加订阅"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldError>{error}</FieldError>
        </Field>
      </FieldGroup>
    </form>
  );
}
