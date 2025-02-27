import {LessonResource} from 'types'
import {getGraphQLClient} from '../utils/configured-graphql-client'
import getAccessTokenFromCookie from '../utils/get-access-token-from-cookie'
import {loadLessonComments} from './lesson-comments'
import {sanityClient} from 'utils/sanity-client'
import groq from 'groq'

const lessonQuery = groq`
*[_type == 'lesson' && slug == $slug][0]{
  title,
  slug,
  description,
  'instructor': collaborators[0]-> {
    'full_name': person->name,
    'slug': person->slug.current,
    'avatar_64_url': person->image.url,
    'twitter_url': person->twitter
  },
  'tags': softwareLibraries[] {
    'name': library->name,
    'label': library->slug.current,
    'http_url': library->url,
    'image_url': library->image.url
  },
  'collection': *[_type=='course' && references(^._id)][0]{
    title,
    'slug': slug.current,
    'type': 'playlist',
    'square_cover_480_url': image,
    'path': '/courses/' + slug.current,
    'lessons': lessons[]-> {
      'slug': slug.current,
      'type': 'lesson',
      'path': '/lessons/' + slug.current,
      'title': title,
      'duration': 0,
      'thumb_url': null,
      'media_url': *[_type=='videoResource' && _id == ^.resource->_id][0].hlsUrl
    }
  }
}`

/**
 * loads LESSON METADATA from Sanity
 * @param slug
 */
async function loadLessonMetadataFromSanity(slug: string) {
  const params = {
    slug,
  }

  const lesson = await sanityClient.fetch(lessonQuery, params)

  return lesson
}

export async function loadLesson(
  slug: string,
  token?: string,
): Promise<LessonResource> {
  token = token || getAccessTokenFromCookie()
  const graphQLClient = getGraphQLClient(token)

  const variables = {
    slug: slug,
  }

  const {lesson} = await graphQLClient.request(
    loadLessonGraphQLQuery,
    variables,
  )

  const lessonMetadataFromSanity = await loadLessonMetadataFromSanity(slug)

  const lessonMetadata = {...lesson, ...lessonMetadataFromSanity}

  // comments are user-generated content that must come from the egghead-rails
  // backend, so load those separately from the rest of lesson metadata.
  const comments = await loadLessonComments(slug, token)

  return {...lessonMetadata, comments} as LessonResource
}

const loadLessonGraphQLQuery = /* GraphQL */ `
  query getLesson($slug: String!) {
    lesson(slug: $slug) {
      slug
      title
      description
      duration
      free_forever
      path
      transcript
      transcript_url
      subtitles_url
      hls_url
      dash_url
      http_url
      media_url
      lesson_view_url
      thumb_url
      icon_url
      download_url
      staff_notes_url
      repo_url
      code_url
      created_at
      updated_at
      published_at
      collection {
        ... on Playlist {
          title
          slug
          type
          square_cover_480_url
          path
          lessons {
            slug
            type
            path
            title
            completed
            duration
            thumb_url
            media_url
          }
        }
        ... on Course {
          title
          slug
          type
          square_cover_480_url
          path
          lessons {
            slug
            type
            path
            title
            completed
            duration
            thumb_url
            media_url
          }
        }
      }
      tags {
        name
        label
        http_url
        image_url
      }
      instructor {
        full_name
        avatar_64_url
        slug
        twitter
      }
    }
  }
`
