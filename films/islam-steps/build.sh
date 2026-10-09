#!/usr/bin/env bash
# Full pipeline: score -> measured beat grid -> loudness -> contact sheet -> motion-blurred render -> mux.
# Usage: films/islam-steps/build.sh [sheet|full]   (default: full)
set -euo pipefail
cd "$(dirname "$0")/../.."
F=films/islam-steps
B=$F/build
mkdir -p "$B"

node $F/score.mjs $B/score_raw.wav
node $F/measure.mjs $B/score_raw.wav $F/beats.json $F/beats.js

# Two-pass loudnorm to -14 LUFS integrated, -1 dBTP.
M=$(ffmpeg -hide_banner -i $B/score_raw.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | sed -n "s/.*\"$1\" : \"\(.*\)\".*/\1/p"; }
ffmpeg -y -loglevel error -i $B/score_raw.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" -ar 48000 $B/score.wav
ffmpeg -hide_banner -i $B/score.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' '

node render/contact.mjs $F/index.html $F/beats.json $B/contact.png 8 216
[ "${1:-full}" = sheet ] && exit 0

node render/render.mjs $F/index.html $B/video.mp4 20 30 1080 1920 "" 0 8 0.5
ffmpeg -y -loglevel error -i $B/video.mp4 -i $B/score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $F/five-steps.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,pix_fmt,width,height,r_frame_rate -of compact $F/five-steps.mp4
