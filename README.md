# PoultrixHub render jobs

Scheduled jobs for the PoultrixHub growth engine: writes the day's draft posts and renders their images and videos (Remotion), then uploads the media to storage. The web app that people use lives in a separate private repository.

This repository holds no secrets. Credentials are GitHub Actions secrets, and the workflow only runs on its schedule or when started by the owner, never from pull requests.
