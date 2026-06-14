import { getUsersWithProfiles } from "@/lib/admin-users";
import { getClasses } from "@/lib/admin-classes";
import { getFaculties, getPrograms } from "@/lib/admin-entities";
import UsersClient from "./UsersClient";

export default async function UsersTable() {
  const users = await getUsersWithProfiles();
  const classes = await getClasses();
  const [faculties, programs] = await Promise.all([getFaculties(), getPrograms()]);
  return <UsersClient users={users} classes={classes} faculties={faculties} programs={programs} />;
}
