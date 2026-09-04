package mpchc

import "testing"

func TestIsRemoteURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want bool
	}{
		{name: "https stream", url: "https://debrid.example/video.mkv?token=a%26b", want: true},
		{name: "http stream", url: "http://127.0.0.1:8080/stream", want: true},
		{name: "uppercase scheme", url: "HTTPS://debrid.example/video", want: true},
		{name: "local path", url: `C:\\Videos\\episode.mkv`, want: false},
		{name: "file URL", url: "file:///Videos/episode.mkv", want: false},
		{name: "missing host", url: "https:///video.mkv", want: false},
		{name: "invalid URL", url: "https://[", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsRemoteURL(tt.url); got != tt.want {
				t.Fatalf("IsRemoteURL(%q) = %v, want %v", tt.url, got, tt.want)
			}
		})
	}
}

func TestLegacyBridgeConfigurationUsesNativeMpcDefaults(t *testing.T) {
	mpc := &MpcHc{
		Host: "127.0.0.1",
		Port: 17890,
		Path: `"C:\\Tools\\seanime-mpc-desktop-bridge.exe"`,
	}

	if got := mpc.GetExecutablePath(); got != `C:\Program Files\MPC-HC\mpc-hc64.exe` {
		t.Fatalf("GetExecutablePath() = %q, want native MPC-HC path", got)
	}

	if got := mpc.url(); got != "http://127.0.0.1:13579" {
		t.Fatalf("url() = %q, want native MPC-HC port", got)
	}
}
