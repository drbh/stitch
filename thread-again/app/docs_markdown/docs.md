# Stitch

> ![NOTE]
> stitch is a work in progress and is expected to change rapidly. This document is a living document and will be updated as the project evolves.

<span class="brand">stitch</span> is a extremely simple app that allows you to make threads and add posts to them.

<hr/>
<br/>

## Key Functionality

- create threads and conditionally share/post to them
- trigger actions on incoming posts
- an always available single source of truth for me and my AI friends
- simple and easy to use
- open source and developer friendly

## Conceptualizing Stitch

<span class="brand">stitch</span> is so simple that it can be a bit hard to describe.

<span class="brand">stitch</span> is like a lot of things, but not exactly like any of them...

at the highest level, <span class="brand">stitch</span> is a place where you can add posts over time and acess them via a URL or API.

<hr/>
<br/>

## Description through analogy

However we can describe it in terms of other things

### kinda like social media and chat

<ul>
  <li>both social media and chat have threads</li>
  <li>social media threads are public and chat threads are private</li>
  <li class="different"><span class="brand">stitch</span> lets you make public and private threads</li>
</ul>

<div
  id="venn-diagram-placeholder"
  style="margin: auto;width: fit-content;"
  data-config='{
    "text1": "Chat",
    "text2": "Social Media",
    "color1": "#00AFFF77",
    "color2": "#8A2BE277"
  }'>
</div>

### kinda like a blog and message queue

<ul>
  <li>both have posts over time</li>
  <li>both have readers who care about some posts and not others</li>
  <li class="different"><span class="brand">stitch</span> provide a single location for multiple readers</li>
</ul>


<div
  id="venn-diagram-placeholder"
  style="margin: auto;width: fit-content;"
  data-config='{
    "text1": "Blog",
    "text2": "Queue",
    "color1": "#39FF1477",
    "color2": "#FF149377"
  }'>
</div>

### kinda like a note app and a chat app

<ul>
  <li>both store media that changes through time (added/updated)</li>
  <li>threads are topical provide a single source of truth</li>
  <li class="different"><span class="brand">stitch</span> lets you defined webhooks to fire on incoming posts</li>
</ul>

<div
  id="venn-diagram-placeholder"
  style="margin: auto;width: fit-content;"
  data-config='{
    "text1": "Note",
    "text2": "Chat",
    "color1": "#00E5FF77",
    "color2": "#FF450077"
  }'>
</div>

<hr/>
<br/>

## Description through features

another way to think about <span class="brand">stitch</span> is in terms of features.

stitch has a couple key features that can be combined in different ways to create different types of threads and fufill different use cases.

| Type | Web | API Key | Webhook | Public URL |
|---|---|---|---|---|
| just me | ✅ | | | |
| me and the world | ✅ | | | ✅ |
| me and a group | ✅ | ✅ | | |
| me and some machines | ✅ | ✅ | ✅ | |

### Types of Stitchs

below are some examples of different types of threads that can be created using the features above - just to give you an idea of the possibilities.

#### just me

- I want to keep a log of my thoughts
- I want to share text, images, and links via a publicly accessible URL
- I do not want to share my thoughts with the world

in this case we can make a thread and just not share the URL with anyone

#### me and the world

- I want to share my thoughts with the world
- I want to share text, images, and links via a publicly accessible URL
- I want to share my thoughts with the world

in this case we can simply create a thread and add a "share url" to the thread. Now anyone with the share url can see the thread!

#### me and a group

- I want to share my thoughts with a group of people (or machines)
- I want to share text, images, and links via a publicly accessible URL
- I do not want to share my thoughts with the world

in this case we can make a thread and add a read only API key to the thread, now only users with the API key can see the thread!

#### me and some machines

- I want to send messages to a machine
- I want to send text, images, and links via a publicly accessible URL
- I do not want to share my thoughts with the world

in this case we can make a thread and add a webhook and read/write API key to the thread. Now the machine can read the thread and we can send messages to the machine by adding posts to the thread!

<hr/>
<br/>

## Always Available

<span class="brand">stitch</span> is always available and can be accessed via the web or API.

this is an important feature of <span class="brand">stitch</span> and one of <span class="brand">stitch</span>'s core values.

in a growing number of situations, its important to be able to access your data from anywhere at anytime.

as AI and machine learning become more prevalent, the ability to read and write data from anywhere at anytime will become increasingly important.

in many cases threads are owned by a large corporation and most importantly is gated from developers.

<span class="brand">stitch</span> is the medicine to this problem. <span class="brand">stitch</span> is a simple, open source, and always available way to store and access your data.

<hr/>
<br/>

## Hows it work?

<span class="brand">stitch</span> has a very simple architecture and only a few moving parts.

at the core of <span class="brand">stitch</span> is a simple <span class="brand">stitch server</span>.

the <span class="brand">stitch server</span> is small REST server that stores and serves threads as well as triggers webhooks, handle API keys, and more.

the <span class="brand">stitch server</span> is backed by a simple database that stores threads and posts.

the <span class="brand">stitch ui</span> is a web app that connects to one or many <span class="brand">stitch servers</span> and allows you to create, read, update, and delete threads and posts.

![DIRECTED_GRAPH]{ "nodes": [ "stitch server N", "stitch server 2", "stitch server 1", "stitch ui"], "edges": [["stitch ui", "stitch server 1"], ["stitch ui", "stitch server 2"], ["stitch ui", "stitch server N"]] }

<br/>

## How to use

<span class="brand">stitch</span> is simple to use and can be accessed via the web or API.

### Deploying your own stitch server

its easy to deploy your own stitch server. just clone [stitch-server](https://github.com/drbh/stitch) and run `npm start`.

### Managed stitch servers

if you dont want to manage your own stitch server, you can use a managed stitch server. just sign up for a free account at [stitch](https://github.com/drbh/stitch) and start creating threads!
