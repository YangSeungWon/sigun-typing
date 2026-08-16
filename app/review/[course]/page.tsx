import { notFound } from "next/navigation";
import { ReviewGame } from "@/components/ReviewGame";
import { COURSES, getCourse } from "@/data/courses";
import { loadCourseGeo } from "@/lib/geo";

export function generateStaticParams() {
  return COURSES.map((course) => ({ course: course.id }));
}

export async function generateMetadata({ params }: PageProps<"/review/[course]">) {
  const { course: courseId } = await params;
  const course = getCourse(courseId);
  if (!course) return {};
  return {
    title: `${course.name} 오답 연습`,
    description: "자주 틀린 곳만 모아서 다시 풉니다.",
  };
}

/** 오답만 골라 푸는 화면. 어떤 곳이 오답인지는 기기에만 있으므로 클라이언트가 고른다. */
export default async function ReviewPage({ params }: PageProps<"/review/[course]">) {
  const { course: courseId } = await params;
  const course = getCourse(courseId);
  if (!course) notFound();

  const geo = await loadCourseGeo(course.id);
  return <ReviewGame course={course} geo={geo} />;
}
