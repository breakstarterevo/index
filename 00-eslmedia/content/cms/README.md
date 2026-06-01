# ESL Media Static CMS Archive

This CMS flow is archived. The normal ESL Media publishing workflow is now the manual HTML workflow:

1. Create or edit the standalone article in `00-eslmedia/content/articles/`.
2. Follow `00-eslmedia/content/articles/README.md` for the required shell, metadata, shared scripts, and writer voice.
3. Add the article object manually to `00-eslmedia/content/media-articles.js`.
4. Add the story to the homepage power board in `00-eslmedia/homepage.html`.
5. Run the normal media validation before publishing.

The old Decap/static-CMS files remain here only so older drafts and generated examples are not lost. Do not add new CMS JSON files or run `00-build/scripts/build_esl_media_static_cms.py` unless the CMS workflow is explicitly revived.
