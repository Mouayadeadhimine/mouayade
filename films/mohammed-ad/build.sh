#!/usr/bin/env bash
# Full pipeline: score -> measured beat grid -> loudness -> contact sheet -> motion-blurred render -> mux.
# Usage: films/islam-steps/build.sh [sheet|full]   (default: full)
set -euo pipefail
cd "$(dirname "$0")/../.."
F=films/mohammed-ad
B=$F/build
mkdir -p "$B"

node $F/score.mjs $B/score_raw.wav
node render/measure.mjs $B/score_raw.wav $F/beats.json $F/beats.js

# Two-pass loudnorm to -14 LUFS integrated, -1 dBTP.
M=$(ffmpeg -hide_banner -i $B/score_raw.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | sed -n "s/.*\"$1\" : \"\(.*\)\".*/\1/p"; }
ffmpeg -y -loglevel error -i $B/score_raw.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" -ar 48000 $B/score.wav
ffmpeg -hide_banner -i $B/score.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' '

VW=1080 VH=1350 node render/contact.mjs $F/index.html $F/beats.json $B/contact.png 8 216
[ "${1:-full}" = sheet ] && exit 0

QUERY=nograin node render/render.mjs $F/index.html $B/video_clean.mp4 20 30 1080 1350 "" 0 8 0.5
# Film grain in post: temporal noise with a fixed seed, so the render stays reproducible.
ffmpeg -y -loglevel error -i $B/video_clean.mp4 -vf "noise=all_seed=1234:alls=9:allf=t" -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p $B/video.mp4
ffmpeg -y -loglevel error -i $B/video.mp4 -i $B/score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $F/mohammed-boudrioua-ad.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,pix_fmt,width,height,r_frame_rate -of compact $F/mohammed-boudrioua-ad.mp4
