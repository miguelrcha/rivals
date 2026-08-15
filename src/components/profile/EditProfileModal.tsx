"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  avatarColor: string;
  avatarInitial: string;
  tagline: string | null;
};

export function EditProfileModal({
  userId,
  avatarUrl,
  bannerUrl,
  avatarColor,
  avatarInitial,
  tagline,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    avatarUrl,
  );
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    bannerUrl,
  );
  const [bio, setBio] = useState(tagline ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setIsOpen(false);
    setError("");
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  function handleRemoveBanner() {
    setBannerFile(null);
    setBannerPreview(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    const supabase = createClient();
    const updates: {
      tagline: string;
      avatar_url?: string;
      banner_url?: string | null;
    } =
      { tagline: bio.trim() };

    try {
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() ?? "png";
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-media")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("profile-media")
          .getPublicUrl(path);
        updates.avatar_url = data.publicUrl;
      }

      if (bannerFile) {
        const ext = bannerFile.name.split(".").pop() ?? "png";
        const path = `${userId}/banner-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-media")
          .upload(path, bannerFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("profile-media")
          .getPublicUrl(path);
        updates.banner_url = data.publicUrl;
      } else if (bannerUrl && !bannerPreview) {
        // User clicked the trash icon to clear their banner.
        updates.banner_url = null;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (updateError) throw updateError;

      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="profile-header__menu"
        onClick={() => setIsOpen(true)}
        aria-label="Edit profile"
        title="Edit profile"
      >
        ⋯
      </button>

      {isOpen && (
        <div className="import-modal-overlay" onClick={close}>
          <div
            className="import-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="import-modal__header">
              <span className="import-modal__title">Edit profile</span>
              <button
                type="button"
                className="import-modal__close"
                onClick={close}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form className="edit-profile-form" onSubmit={handleSubmit}>
              <div
                className="edit-profile-form__banner"
                style={{
                  backgroundImage: bannerPreview
                    ? `url(${bannerPreview})`
                    : undefined,
                  background: !bannerPreview ? avatarColor : undefined,
                }}
              >
                <label className="edit-profile-form__upload">
                  Change banner
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerChange}
                    hidden
                  />
                </label>

                {bannerPreview && (
                  <button
                    type="button"
                    className="edit-profile-form__banner-remove"
                    onClick={handleRemoveBanner}
                    aria-label="Remove banner"
                    title="Remove banner"
                  >
                    🗑
                  </button>
                )}
              </div>

              <div className="edit-profile-form__avatar-row">
                <div
                  className="edit-profile-form__avatar-preview"
                  style={{ background: avatarColor }}
                >
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="" />
                  ) : (
                    avatarInitial
                  )}
                </div>
                <label className="edit-profile-form__upload">
                  Change photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    hidden
                  />
                </label>
              </div>

              <div className="edit-profile-form__field">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Tell the crew about yourself..."
                  maxLength={160}
                  rows={3}
                />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button
                type="submit"
                className="import-modal__submit edit-profile-form__submit"
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
