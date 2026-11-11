# Staged copy of the tap cask. The live file is
# github.com/juliusnguyen/homebrew-tap : Casks/shadynotes.rb
# (this copy exists so the cask is versioned and reviewable alongside the infra;
#  scripts/release-cask.sh bumps version/sha256 in the TAP and here).
#
# Serves the same notarised, versioned DMG as the website's download button, from
# downloads.shadynotes.app (2026-11-11; it used to point at a GitHub releases repo
# holding only the 4.1.3 ad-hoc test build). Installs from it are counted in the
# downloads Worker's `homebrew` column.
cask "shadynotes" do
  version "4.1.19"
  sha256 "bd4e9c6c7508478b3080c9df373de091e04cac63578c6fc9d16bbbaafbda8188"

  url "https://downloads.shadynotes.app/macos/ShadyNotes-#{version}.dmg"
  name "Shady Notes"
  desc "Menu-bar markdown notes app that slides down like a window shade"
  homepage "https://shadynotes.app/"

  livecheck do
    url "https://downloads.shadynotes.app/macos/appcast.xml"
    strategy :sparkle, &:short_version
  end

  # The app updates itself with Sparkle; brew leaves it alone unless --greedy.
  auto_updates true
  depends_on macos: :ventura

  app "ShadyNotes.app"

  zap trash: [
    "~/Library/Application Support/ShadyNotes",
    "~/Library/Caches/dev.jscott.shadynotes",
    "~/Library/HTTPStorages/dev.jscott.shadynotes",
    "~/Library/Preferences/dev.jscott.betterunclutter.plist",
    "~/Library/Preferences/dev.jscott.shadynotes.plist",
  ]
  # Deliberately NOT zapped: ~/Documents/ShadyNotes (the user's notes vault)
end
