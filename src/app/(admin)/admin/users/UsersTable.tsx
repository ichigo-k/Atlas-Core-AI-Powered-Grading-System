import { getUsersWithProfiles } from "@/lib/admin-users";
import { getClasses, getCourses } from "@/lib/admin-classes";
import { getFaculties, getPrograms } from "@/lib/admin-entities";
import UsersClient from "./UsersClient";

export default async function UsersTable() {
  const users = await getUsersWithProfiles();
  const classes = await getClasses();
  const [faculties, programs, courses] = await Promise.all([
    getFaculties(),
    getPrograms(),
    getCourses(),
  ]);
  return (
    <UsersClient
      users={users}
      classes={classes}
      faculties={faculties}
      programs={programs}
      courses={courses}
    />
  );
}
