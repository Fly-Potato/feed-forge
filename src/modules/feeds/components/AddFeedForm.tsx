import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface AddFeedFormProps {
  onAdd: (url: string) => Promise<unknown>;
}

export function AddFeedForm({ onAdd }: AddFeedFormProps) {
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
    setError(null);
    try {
      await onAdd(value);
      setUrl("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "添加订阅源失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <Field>
        <FieldLabel htmlFor="feed-url">订阅源地址</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="feed-url"
            name="url"
            type="url"
            placeholder="https://example.com/feed.xml"
            value={url}
            onChange={(event) => setUrl(event.currentTarget.value)}
            disabled={submitting}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "正在添加..." : "添加订阅"}
          </Button>
        </div>
      </Field>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
