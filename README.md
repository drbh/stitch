<img width="800" alt="threadscreen" src="https://github.com/user-attachments/assets/668bf880-f073-4447-a17d-a6d1dd093707" />

# thread

thread is a small personal tool to track things through time.

at its core `thread` is a simple `unsocial media` app. it has no intentions of sharing/communicating with anyone else but myself.

its main purpose is to take the good parts of social media apps (threads, posts, etc) and strip away the bad parts (other people).

## Why

while `thread` is a very simple set of features, it aspires provide value outside of the features themselves.

what I mean here, is that the limited features are intentional

we want to be slightly better than a text file, but not as complex as a full blown todo app/social media app.

## Getting started

run the server:

```bash
uv run server.py
```

run the ui:

```bash
npm run dev --prefix ./thread
```

we recommend using `tmux` to run both the server and the ui at the same time and allow you to keep it running in the background.

```bash
make run
```

you can close the tmux session by pressing `ctrl+b` then `d`

re-attach to the tmux session by running:

```bash
make attach
```

## Usage

open the app in your browser:

```bash
http://localhost:5173/
```

additionally the server provides a openapi schema at:

```bash
http://127.0.0.1:8000/docs#/
```

## Features



| Feature            | Description                                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create `threads`   | Create a new thread. Threads contain posts and documents. They track a single topic through time.                                                                                                                 |
| Create `posts`     | Create a new post. Posts are the main content of a thread. Every post is recorded on the post activity chart.                                                                                                     |
| Create `documents` | Create a new document. Documents are files that are attached to a thread. Markdown, CSV and text files are supported. Documents are editable.                                                                     |
| Timebar            | The top bar shows the current time in various timezones and shows the week number and day of the year.                                                                                                            |
| Post chart         | The post chart is reminiscent of the GitHub contribution chart. It shows the activity of posts over time. In a quick glance you can see how active a thread is.                                                   |
| Thread views       | Each time a thread is viewed, it is recorded. This allows you to see how active a thread is.                                                                                                                      |
| Post Timeline      | Posts are arranged chronologically. Each thread has a timeline that shows the posts in order.                                                                                                                     |
| Document Panel     | Documents are rendered in the browser. Markdown files are rendered as HTML. CSV files are rendered as tables. Text files are rendered as text. The panel is resizable, and supports editing/viewing the document. |

in addition to the features above, `thread` is designed to be very simple and just acts as a way to put arbitrary data into a timeline in a programmatic and structured way.

outside of the app features above, the API is designed to be simple and easy to use. Integrating with other tools should be easy - and adding non human contributors is as simple as a curl request.

## similar-ish ideas

- Zettelkasten; https://zettelkasten.de/
- Digital Garden; https://jzhao.xyz/posts/networked-thought
- Personal Knowledge Management; https://www.reddit.com/r/PKMS/

## how it's different

`thread` at its core is just a way to track things through time and structure data such that its easy for humans to think about, and easy for machines/agents to process/collaborate with.

### what it's not

- its not a todo list app since we don't have due dates or priorities
- its not a note taking app since we don't have a concept of a note (everything is under a thread)
- its not a social media app since we don't have followers or likes
- its not a wiki since we don't attempt to link things together
- its not a blog since we only share it with ourselves and our agents

### what it is

- a way to track things through time
- a easy way to see an activity chart of anything you post about
- a simple shared timeline that machines/agents can query/add to
- a tool to externalize your thoughts and memories
- a open source local-first tool for private thread tracking
- just a tool for me to help record more things this year
