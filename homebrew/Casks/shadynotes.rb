# Staged copy of the tap cask — the live file belongs in
# github.com/juliusnguyen/homebrew-tap : Casks/shadynotes.rb
# (this copy exists so the cask is versioned/reviewable alongside the infra;
#  scripts/release-cask.sh updates version/sha256 in the TAP, not here).
#
# Currently pinned to the v4.1.3 AD-HOC TEST build (pipeline validation only);
# the release script bumps to the notarised 4.1.4 when it exists.
cask "shadynotes" do
  version "4.1.3"
  sha256 "fd720a2918699654b90c1e6f680278fe2936f5e7d19dc89faa2fa6882a146bba"

  url "https://github.com/juliusnguyen/shadynotes-releases/releases/download/v#{version}/ShadyNotes-#{version}.dmg",
      verified: "github.com/juliusnguyen/shadynotes-releases/"
  name "Shady Notes"
  desc "Menu-bar markdown notes app that slides down like a window shade"
  homepage "https://shadynotes.app/"

  livecheck do
    url :url
    strategy :github_latest
  end

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
