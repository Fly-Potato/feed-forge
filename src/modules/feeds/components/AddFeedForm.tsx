import { useState, type FormEvent } from "react";

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { FeedGroup } from "../types";

interface AddFeedFormProps {
  groups: FeedGroup[];
  onAdd: (url: string, groupId: number | null) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
}

export function AddFeedForm({ groups, onAdd, onBusyChange }: AddFeedFormProps) {
  const [url, setUrl] = useState("");
  const [groupId, setGroupId] = useState("ungrouped");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupItems = [
    { value: "ungrouped", label: "未分组" },
    ...groups.map((group) => ({ value: String(group.id), label: group.title })),
  ];

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
      await onAdd(value, groupId === "ungrouped" ? null : Number(groupId));
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
        <Field>
          <FieldLabel htmlFor="feed-group">添加到分组</FieldLabel>
          <Select items={groupItems} value={groupId} onValueChange={(value) => value && setGroupId(value)}>
            <SelectTrigger id="feed-group" aria-label="添加到分组" className="w-full" disabled={submitting}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {groupItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </form>
  );
}
