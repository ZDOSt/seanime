package mpchc

import (
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"path/filepath"
	"seanime/internal/util"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

type MpcHc struct {
	Host   string
	Port   int
	Path   string
	Logger *zerolog.Logger
}

func (api *MpcHc) url() string {
	port := api.Port
	if isLegacyBridgePath(api.Path) {
		port = 13579
	}

	return fmt.Sprintf("http://%s:%d", api.Host, port)
}

// Execute sends a command to MPC and returns the response.
func (api *MpcHc) Execute(command int, data map[string]interface{}) (string, error) {
	url := fmt.Sprintf("%s/command.html?wm_command=%d", api.url(), command)

	if data != nil {
		queryParams := neturl.Values{}
		for key, value := range data {
			queryParams.Add(key, fmt.Sprintf("%v", value))
		}
		url += "&" + queryParams.Encode()
	}

	response, err := http.Get(url)
	if err != nil {
		api.Logger.Error().Err(err).Msg("mpc hc: Failed to execute command")
		return "", err
	}
	defer response.Body.Close()

	// Check HTTP status code and errors
	statusCode := response.StatusCode
	if !((statusCode >= 200) && (statusCode <= 299)) {
		err = fmt.Errorf("http error code: %d\n", statusCode)
		return "", err
	}

	// Get byte response and http status code
	byteArr, readErr := io.ReadAll(response.Body)
	if readErr != nil {
		err = fmt.Errorf("error reading response: %s\n", readErr)
		return "", err
	}

	// Write response
	res := string(byteArr)

	return res, nil
}

func escapeInput(input string) string {
	if strings.HasPrefix(input, "http") {
		return neturl.QueryEscape(input)
	} else {
		input = filepath.FromSlash(input)
		return strings.ReplaceAll(neturl.QueryEscape(input), "+", "%20")
	}
}

// IsRemoteURL reports whether mediaPath is an HTTP(S) URL that MPC-HC can
// open directly. Remote stream URLs must be passed as a process argument;
// MPC-HC's browser endpoint does not reliably load debrid/torrent URLs.
func IsRemoteURL(mediaPath string) bool {
	parsed, err := neturl.Parse(mediaPath)
	if err != nil || parsed.Host == "" {
		return false
	}

	return strings.EqualFold(parsed.Scheme, "http") || strings.EqualFold(parsed.Scheme, "https")
}

// OpenAndPlay opens a video file in MPC.
func (api *MpcHc) OpenAndPlay(filePath string) (string, error) {
	if IsRemoteURL(filePath) {
		return api.openRemoteURL(filePath)
	}

	url := fmt.Sprintf("%s/browser.html?path=%s", api.url(), escapeInput(filePath))
	api.Logger.Trace().Str("url", url).Msg("mpc hc: Opening and playing")

	response, err := http.Get(url)
	if err != nil {
		api.Logger.Error().Err(err).Msg("mpc hc: Failed to connect to MPC")
		return "", err
	}
	defer response.Body.Close()

	// Check HTTP status code and errors
	statusCode := response.StatusCode
	if !((statusCode >= 200) && (statusCode <= 299)) {
		err = fmt.Errorf("http error code: %d\n", statusCode)
		api.Logger.Error().Err(err).Msg("mpc hc: Failed to open and play")
		return "", err
	}

	// Get byte response and http status code
	byteArr, readErr := io.ReadAll(response.Body)
	if readErr != nil {
		err = fmt.Errorf("error reading response: %s\n", readErr)
		api.Logger.Error().Err(err).Msg("mpc hc: Failed to open and play")
		return "", err
	}

	// Write response
	res := string(byteArr)

	return res, nil
}

// openRemoteURL launches MPC-HC with the stream URL as a native media
// argument. This is the same handoff a user gets by opening the URL directly
// in MPC-HC and avoids the unreliable browser.html path for remote streams.
func (api *MpcHc) openRemoteURL(mediaURL string) (string, error) {
	executable := api.GetExecutablePath()
	api.Logger.Trace().Str("path", mediaURL).Msg("mpc hc: Opening remote URL directly")

	cmd := util.NewCmd(executable, mediaURL)
	if workingDirectory := filepath.Dir(executable); workingDirectory != "." {
		cmd.Dir = workingDirectory
	}

	if err := cmd.Start(); err != nil {
		api.Logger.Error().Err(err).Msg("mpc hc: Failed to open remote URL directly")
		return "", fmt.Errorf("error opening remote URL in MPC-HC: %w", err)
	}

	// Give MPC-HC time to hand the command to an existing instance before
	// Seanime performs watch-continuity commands or starts status polling.
	time.Sleep(1 * time.Second)

	return "MPC-HC opened remote media", nil
}

// GetVariables retrieves player variables from MPC.
func (api *MpcHc) GetVariables() (*Variables, error) {
	url := fmt.Sprintf("%s/variables.html", api.url())

	response, err := http.Get(url)
	if err != nil {
		api.Logger.Error().Err(err).Msg("mpc hc: Failed to get variables")
		return &Variables{}, err
	}
	defer response.Body.Close()

	// Check HTTP status code and errors
	statusCode := response.StatusCode
	if !((statusCode >= 200) && (statusCode <= 299)) {
		err = fmt.Errorf("http error code: %d\n", statusCode)
		api.Logger.Error().Err(err).Msg("mpc hc: Failed to get variables")
		return &Variables{}, err
	}

	// Get byte response and http status code
	byteArr, readErr := io.ReadAll(response.Body)
	if readErr != nil {
		err = fmt.Errorf("error reading response: %s\n", readErr)
		api.Logger.Error().Err(err).Msg("mpc hc: Failed to get variables")
		return &Variables{}, err
	}

	// Write response
	res := string(byteArr)
	vars := parseVariables(res)

	return vars, nil
}
