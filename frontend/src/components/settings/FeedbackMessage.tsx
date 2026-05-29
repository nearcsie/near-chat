export type SettingsFeedback = {
  type: "success" | "error";
  text: string;
};

export default function FeedbackMessage({ feedback }: { feedback: SettingsFeedback | null }) {
  if (!feedback) return null;

  return (
    <div
      className={`mb-4 border rounded-sm px-4 py-3 text-xs font-semibold ${
        feedback.type === "error"
          ? "border-red-600 text-red-700 bg-red-50"
          : "border-primary text-primary bg-surface-muted"
      }`}
    >
      {feedback.text}
    </div>
  );
}
